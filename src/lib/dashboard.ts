import "server-only";
import { assertMongoConfiguration } from "@/lib/mongo-diagnostics";
import { MongoClient, type Document } from "mongodb";

const globalMongo = globalThis as typeof globalThis & { mongoRead?: Promise<MongoClient> };
const options = { maxTimeMS: 15000 };
export async function dashboard(params: URLSearchParams) {
  const env = process.env;
  assertMongoConfiguration(env);
  globalMongo.mongoRead ??= new MongoClient(env.AUTOMATION_IG_MONGO_URI, {
    serverSelectionTimeoutMS: 8000, maxPoolSize: 5,
  }).connect().catch(error => { globalMongo.mongoRead = undefined; throw error; });
  const client = await globalMongo.mongoRead;
  const db = client.db(env.AUTOMATION_IG_STAGING_DATABASE || env.AUTOMATION_IG_MONGO_DATABASE);
  const state = db.collection(env.AUTOMATION_IG_STATE_COLLECTION || "ig-post-lambda-state");
  const staging = db.collection(env.AUTOMATION_IG_STAGING_COLLECTION || "ig-post-lambda-staging");
  const usage = db.collection(env.AUTOMATION_IG_USAGE_COLLECTION || "ig-post-lambda-usage");
  const [jobs, dates, finishedDates, outputCount, stagingCount] = await Promise.all([
    state.find({ record_type: "source_job" }, { ...options, projection: { benchmark_id:1, location_id:1, date_from:1, date_until:1, rows_scanned:1, source_done:1, created_at:1, updated_at:1, source_finished_at:1, "cursor.user_done":1 } }).sort({ created_at:-1 }).limit(100).toArray(),
    usage.aggregate([{$match:{record_type:{$in:["run","post_count","api_usage"]},reporting_date_my:{$type:"string"}}},{$group:{_id:"$reporting_date_my"}},{$sort:{_id:-1}}],options).toArray(),
    usage.aggregate([{$match:{record_type:"api_usage",operation:"embedding",finished_at:{$type:"date"}}},{$group:{_id:{$dateToString:{date:"$finished_at",format:"%Y-%m-%d",timezone:"Asia/Kuala_Lumpur"}}}},{$sort:{_id:-1}}],options).toArray(),
    client.db(env.AUTOMATION_IG_MONGO_DATABASE).collection(env.AUTOMATION_IG_MONGO_COLLECTION || "ig-post-lambda-output").countDocuments({},options),
    staging.countDocuments({},options),
  ]);
  const dateValues = dates.map(d=>String(d._id));
  const finishedValues = finishedDates.map(d=>String(d._id));
  const requestedDate = params.get("date") || "";
  const date = dateValues.includes(requestedDate) ? requestedDate : dateValues[0] || "";
  const finished = finishedValues.includes(params.get("finished") || "") ? params.get("finished")! : "";
  const retainedByJob=await staging.aggregate([{$match:{workflow_ids:{$in:jobs.map(j=>String(j._id))}}},{$unwind:"$workflow_ids"},{$group:{_id:"$workflow_ids",retained:{$sum:1},outstanding:{$sum:{$cond:[{$or:[{$eq:["$jobs.embed.status","skipped"]},{$and:[{$eq:["$jobs.embed.status","completed"]},{$eq:["$publish_status","published"]}]}]},0,1]}}}}],options).toArray();
  const completedJobs=jobs.filter(j=>j.source_done&&retainedByJob.some(g=>g._id===String(j._id)&&g.retained>0&&g.outstanding===0));
  const job=params.get("view")==="live"?jobs[0]:completedJobs.find(j=>String(j._id)===params.get("job"))||completedJobs[0];
  const status = ["pending","processing","completed","failed","skipped"].includes(params.get("status") || "") ? params.get("status")! : "";
  const page = Math.max(1,Math.min(10000,parseInt(params.get("page") || "1") || 1));
  const filter = {workflow_ids:job?String(job._id):"__no_selected_job__"};
  const postId=(params.get("postId")||"").trim(),userId=(params.get("userId")||"").trim(),publication=(params.get("publication")||"").trim();
  if((postId&&!/^\d{1,30}$/.test(postId))||(userId&&!/^\d{1,30}$/.test(userId)))throw Error("Invalid identifier");
  const postFilter = {...filter,...(status ? {"jobs.embed.status":status} : {}),...(postId?{post_id:postId}:{}),...(userId?{user_id:userId}:{}),...(publication?{publish_status:publication}: {})};
  const costMatch: Document = {record_type:"api_usage",operation:"embedding"};
  if (finished) {
    const start = new Date(finished+"T00:00:00+08:00");
    costMatch.finished_at = {$gte:start,$lt:new Date(start.getTime()+86400000)};
  }
  const groupFields = {
    count:{$sum:1},input_tokens:{$sum:"$input_tokens"},output_tokens:{$sum:"$output_tokens"},
    estimated_usd:{$sum:"$estimated_cost_usd"},
    unknown_cost_calls:{$sum:{$cond:[{$eq:[{$ifNull:["$estimated_cost_usd",null]},null]},1,0]}},
  };
  const [groups,posts,postCount,events,costs] = await Promise.all([
    staging.aggregate([{$match:filter},{$group:{_id:{embed:"$jobs.embed.status",publish:"$publish_status"},count:{$sum:1}}}],options).toArray(),
    staging.find(postFilter,{...options,projection:{post_id:1,user_id:1,caption:1,created_at:1,synced_at:1,published_at:1,embedding_model:1,"jobs.embed.status":1,"jobs.embed.attempts":1,"jobs.embed.error_type":1,"jobs.embed.reason":1,publish_status:1}}).sort({_id:1}).skip((page-1)*5).limit(5).toArray(),
    staging.countDocuments(postFilter,options),
    usage.aggregate([{$match:{reporting_date_my:date,record_type:{$in:["post_count","api_usage"]}}},{$group:{_id:{run_id:"$run_id",type:"$record_type",metric:"$metric",operation:"$operation",outcome:"$outcome"},...groupFields}}],options).toArray(),
    usage.aggregate([{$match:costMatch},{$group:{_id:{outcome:"$outcome",pricing:"$pricing.version",source:"$usage_source"},...groupFields}}],options).toArray(),
  ]);
  const eventRunIds=[...new Set(events.map(e=>e._id.run_id).filter((id):id is string=>typeof id==="string"))];
  const runDocs=await db.collection<Document & {_id:string}>(usage.collectionName).find({record_type:"run",$or:[{reporting_date_my:date},{_id:{$in:eventRunIds}}]},{...options,projection:{stage:1,status:1,locationId:1,started_at:1,finished_at:1}}).toArray();
  const totals = {counts:{} as Record<string,number>,estimated_usd:0,unknown_cost_calls:0,input_tokens:0,output_tokens:0};
  const runs = runDocs.map(run=>({
    run_id:String(run._id),stage:run.stage,status:run.status,locationId:run.locationId,
    counts:{} as Record<string,number>,
    api:{} as Record<string,Record<string,{count:number,input_tokens:number,output_tokens:number,estimated_usd:number,unknown_cost_calls:number}>>,
  }));
  const runMap = new Map(runs.map(run=>[run.run_id,run]));
  for (const event of events) {
    let run = runMap.get(String(event._id.run_id));
    if (!run) {
      run = {run_id:String(event._id.run_id),stage:"unknown",status:"unknown",locationId:null,counts:{},api:{}};
      runs.push(run); runMap.set(run.run_id,run);
    }
    if (event._id.type === "post_count") {
      run.counts[event._id.metric] = event.count;
      totals.counts[event._id.metric] = (totals.counts[event._id.metric] || 0)+event.count;
    } else {
      const values = {count:event.count,input_tokens:event.input_tokens,output_tokens:event.output_tokens,estimated_usd:event.estimated_usd,unknown_cost_calls:event.unknown_cost_calls};
      (run.api[event._id.operation] ??= {})[event._id.outcome] = values;
      totals.estimated_usd += values.estimated_usd;
      totals.unknown_cost_calls += values.unknown_cost_calls;
      totals.input_tokens += values.input_tokens;
      totals.output_tokens += values.output_tokens;
    }
  }
  const report = {reporting_date_my:date,run_count:runs.length,totals,runs};
  const jobRuns = job ? await usage.find({record_type:"run",job_id:String(job._id)},{
    ...options,projection:{_id:1,stage:1,started_at:1,finished_at:1,status:1}
  }).toArray() : [];
  const jobRunIds = jobRuns.map(r=>r._id);
  const lastFinished = jobRuns.map(r=>r.finished_at).filter(Boolean).sort((a,b)=>new Date(b).getTime()-new Date(a).getTime())[0] || null;
  const extractionMatch = {record_type:"api_usage",operation:"extraction",run_id:{$in:jobRunIds}};
  const [extraction, apiDetails, overallCosts, timeline, stageBreakdown, jobCosts] = await Promise.all([
    usage.aggregate([{$match:extractionMatch},{$group:{_id:{outcome:"$outcome",pricing:"$pricing.version",source:"$usage_source"},...groupFields}}],options).toArray(),
    usage.aggregate([{$match:costMatch},{$sort:{recorded_at:-1}},{$facet:{
      api_succeeded:[{$match:{outcome:"api_succeeded"}},{$limit:25},{$project:{post_id:1,run_id:1,model:1,recorded_at:1,finished_at:1,input_tokens:1,output_tokens:1,estimated_cost_usd:1,error_type:1,usage_source:1}}],
      api_failed:[{$match:{outcome:"api_failed"}},{$limit:25},{$project:{post_id:1,run_id:1,model:1,recorded_at:1,finished_at:1,input_tokens:1,output_tokens:1,estimated_cost_usd:1,error_type:1,usage_source:1}}],
      started:[{$match:{outcome:"started"}},{$limit:25},{$project:{post_id:1,run_id:1,model:1,recorded_at:1,finished_at:1,input_tokens:1,output_tokens:1,estimated_cost_usd:1,error_type:1,usage_source:1}}]
    }}],options).toArray(),
    usage.aggregate([{$match:{record_type:"api_usage",operation:{$in:["embedding","extraction"]}}},{$group:{_id:"$operation",...groupFields}}],options).toArray(),
    usage.aggregate([{$match:{record_type:"api_usage",run_id:{$in:jobRunIds},recorded_at:{$type:"date"}}},{$group:{_id:{$dateToString:{date:"$recorded_at",format:"%Y-%m-%dT%H:%M:00",timezone:"Asia/Kuala_Lumpur"}},calls:{$sum:1},tokens:{$sum:"$input_tokens"},cost:{$sum:"$estimated_cost_usd"},failed:{$sum:{$cond:[{$eq:["$outcome","api_failed"]},1,0]}}}},{$sort:{_id:1}}],options).toArray(),
    usage.aggregate([{$match:{record_type:"run",job_id:job ? String(job._id) : "__none__"}},{$group:{_id:{stage:"$stage",status:"$status"},count:{$sum:1}}}],options).toArray(),
    usage.aggregate([{$match:{record_type:"api_usage",run_id:{$in:jobRunIds}}},{$group:{_id:"$operation",...groupFields}}],options).toArray()
  ]);
  const embedRuns=jobRuns.filter(r=>r.stage==="lambda-embed");
  const embedStarted=embedRuns.map(r=>r.started_at).filter(Boolean).sort((a,b)=>new Date(a).getTime()-new Date(b).getTime())[0]||null;
  const embedFinished=embedRuns.map(r=>r.finished_at).filter(Boolean).sort((a,b)=>new Date(b).getTime()-new Date(a).getTime())[0]||null;
  const failuresForDetail=apiDetails[0]?.api_failed||[];
  if(failuresForDetail.length){
    const ids=failuresForDetail.map((f:Document)=>f.post_id);
    const [currentPosts,laterAttempts]=await Promise.all([
      staging.find({post_id:{$in:ids}},{...options,projection:{_id:0,post_id:1,publish_status:1,"jobs.embed.status":1,"jobs.embed.attempts":1}}).toArray(),
      usage.aggregate([{$match:{record_type:"api_usage",operation:"embedding",post_id:{$in:ids}}},{$sort:{recorded_at:-1}},{$group:{_id:"$post_id",latest:{$first:{recorded_at:"$recorded_at",outcome:"$outcome",run_id:"$run_id",error_type:"$error_type"}}}}],options).toArray()
    ]);
    for(const failure of failuresForDetail){failure.currentPost=currentPosts.find(p=>p.post_id===failure.post_id);const latest=laterAttempts.find(a=>a._id===failure.post_id)?.latest;failure.laterAttempt=latest&&new Date(latest.recorded_at).getTime()>new Date(failure.recorded_at).getTime()?latest:null;}
  }
  const timedRuns=jobRuns.filter(r=>r.started_at&&r.finished_at&&new Date(r.finished_at).getTime()>=new Date(r.started_at).getTime());
  const totalRunSeconds=timedRuns.reduce((n,r)=>n+(new Date(r.finished_at).getTime()-new Date(r.started_at).getTime())/1000,0);
  const timing = {
    totalRunSeconds,timedRunCount:timedRuns.length,
    embedStarted,embedFinished,embedSeconds:embedStarted&&embedFinished?(new Date(embedFinished).getTime()-new Date(embedStarted).getTime())/1000:null,
    sourceSeconds:job?.source_finished_at && job?.created_at ? (new Date(job.source_finished_at).getTime()-new Date(job.created_at).getTime())/1000 : null,
    observedSeconds:lastFinished && job?.created_at ? (new Date(lastFinished).getTime()-new Date(job.created_at).getTime())/1000 : null,
    lastFinished,runCount:jobRuns.length,unfinishedRuns:jobRuns.filter(r=>!r.finished_at).length
  };

  const lastActivity = [job?.updated_at,job?.source_finished_at,lastFinished,...jobRuns.map(r=>r.started_at)].filter(Boolean).sort((a,b)=>new Date(b).getTime()-new Date(a).getTime())[0] || null;
  const outstanding = groups.filter(g=>!(g._id.embed==="completed"&&g._id.publish==="published")&&g._id.embed!=="skipped").reduce((n,g)=>n+g.count,0);
  const recent = lastActivity && Date.now()-new Date(lastActivity).getTime()<5*60*1000;
  const failures = groups.filter(g=>g._id.embed==="failed").reduce((n,g)=>n+g.count,0);
  const activity = {
    state:!job?"idle":job.source_done&&outstanding===0?"completed":!recent?"stale":failures?"attention":!job.source_done?"fetching":"embedding",
    lastActivity, outstanding, failures,
    processing:groups.filter(g=>g._id.embed==="processing").reduce((n,g)=>n+g.count,0),
    pending:groups.filter(g=>g._id.embed==="pending").reduce((n,g)=>n+g.count,0)
  };
  // Plain DTOs only: no vectors, connection metadata, raw errors, or worker tokens.
  return JSON.parse(JSON.stringify({
    jobs:params.get("view")==="live"?jobs:completedJobs,job:job || null,lastJob:jobs[0] || null,dates:dateValues,finishedDates:finishedValues,
    date,finished,status,page,outputCount,stagingCount,groups,posts,postCount,costs,report,extraction,timing,jobCosts,overallCosts,timeline,stageBreakdown,activity,apiDetails:apiDetails[0] || {},
    refreshedAt:new Date().toISOString(),
  })) as DashboardData;
}
export interface Job { _id:string; benchmark_id:string;location_id:number;date_from:string;date_until:string;rows_scanned:number;source_done:boolean;created_at:string;updated_at?:string;source_finished_at?:string;cursor?:{user_done:boolean} }
export interface ApiTotals {count:number;input_tokens:number;output_tokens:number;estimated_usd:number;unknown_cost_calls:number}
export interface Run {run_id:string;stage:string;status:string;locationId:number|null;counts:Record<string,number>;api:Record<string,Record<string,ApiTotals>>}
export interface ApiDetail { _id:string;post_id:string;run_id:string;model?:string;recorded_at:string;finished_at?:string;input_tokens?:number;output_tokens?:number;estimated_cost_usd?:number|null;error_type?:string;usage_source?:string;currentPost?:{publish_status?:string;jobs?:{embed?:{status?:string;attempts?:number}}};laterAttempt?:{recorded_at:string;outcome:string;run_id:string;error_type?:string}|null }
export interface DashboardData {
 jobCosts:({ _id:string } & ApiTotals)[];
 overallCosts:({ _id:string } & ApiTotals)[];
 timeline:{_id:string;calls:number;tokens:number;cost:number;failed:number}[];
 stageBreakdown:{_id:{stage:string;status:string};count:number}[];
 activity:{state:string;lastActivity:string|null;outstanding:number;failures:number;processing:number;pending:number};

 extraction:({ _id:{outcome:string;pricing:string;source:string} } & ApiTotals)[];
 timing:{totalRunSeconds:number;timedRunCount:number;embedStarted:string|null;embedFinished:string|null;embedSeconds:number|null;sourceSeconds:number|null;observedSeconds:number|null;lastFinished:string|null;runCount:number;unfinishedRuns:number};
 apiDetails:Record<string,ApiDetail[]>;

 jobs:Job[];job:Job|null;lastJob:Job|null;dates:string[];finishedDates:string[];date:string;finished:string;status:string;page:number;outputCount:number;stagingCount:number;postCount:number;refreshedAt:string;
 groups:{_id:{embed:string;publish:string};count:number}[];
 posts:{_id:string;post_id:string;user_id?:string;created_at?:string;synced_at?:string;published_at?:string;embedding_model?:string;caption:string;publish_status:string;jobs?:{embed?:{status:string;attempts:number;error_type?:string;reason?:string}}}[];
 costs:({ _id:{outcome:string;pricing:string;source:string} } & ApiTotals)[];
 report:{reporting_date_my:string;run_count:number;totals:{counts:Record<string,number>;estimated_usd:number;unknown_cost_calls:number;input_tokens:number;output_tokens:number};runs:Run[]};
}

export async function inspectRun(id: string, page = 1) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const env=process.env;
  if (!env.AUTOMATION_IG_MONGO_URI) throw new Error("configuration");
  globalMongo.mongoRead ??= new MongoClient(env.AUTOMATION_IG_MONGO_URI,{serverSelectionTimeoutMS:8000,maxPoolSize:5}).connect().catch(e=>{globalMongo.mongoRead=undefined;throw e;});
  const client=await globalMongo.mongoRead;
  const db=client.db(env.AUTOMATION_IG_STAGING_DATABASE||env.AUTOMATION_IG_MONGO_DATABASE);
  const usage=db.collection<Document & {_id:string}>(env.AUTOMATION_IG_USAGE_COLLECTION||"ig-post-lambda-usage");
  // UUIDs are stored as strings in the Python usage collection.
  const run=await usage.findOne({record_type:"run",_id:id},{...options,projection:{stage:1,status:1,started_at:1,finished_at:1,job_id:1,aws_request_id:1,benchmark_id:1,locationId:1,date_from:1,date_until:1}});
  if(!run)return null;
  const [counts,api,linked] = await Promise.all([
    usage.aggregate([{$match:{run_id:id,record_type:"post_count"}},{$group:{_id:"$metric",count:{$sum:1}}}],options).toArray(),
    usage.aggregate([{$match:{run_id:id,record_type:"api_usage"}},{$group:{_id:{operation:"$operation",outcome:"$outcome",model:"$model",error:"$error_type"},calls:{$sum:1},input:{$sum:"$input_tokens"},output:{$sum:"$output_tokens"},cost:{$sum:"$estimated_cost_usd"},unknown:{$sum:{$cond:[{$eq:[{$ifNull:["$estimated_cost_usd",null]},null]},1,0]}}}}],options).toArray(),
    usage.aggregate([{$match:{run_id:id,record_type:{$in:["api_usage","post_count"]},post_id:{$type:"string"}}},{$group:{_id:"$post_id",metrics:{$addToSet:"$metric"},outcomes:{$addToSet:"$outcome"}}},{$sort:{_id:1}},{$facet:{
      total:[{$count:"count"}],
      posts:[{$skip:(page-1)*3},{$limit:3},{$lookup:{from:env.AUTOMATION_IG_STAGING_COLLECTION||"ig-post-lambda-staging",localField:"_id",foreignField:"post_id",pipeline:[{$project:{_id:0,caption:1,publish_status:1,"jobs.embed.status":1,"jobs.embed.error_type":1}}],as:"current"}},{$project:{post_id:"$_id",_id:0,metrics:1,outcomes:1,current:{$arrayElemAt:["$current",0]}}}]
    }}],options).toArray()
  ]);
  return JSON.parse(JSON.stringify({run,counts,api,posts:linked[0]?.posts||[],total:linked[0]?.total[0]?.count||0,page})) as RunInspection;
}
export interface RunInspection {
 run:{_id:string;stage:string;status:string;started_at:string;finished_at?:string;aws_request_id?:string;job_id?:string;benchmark_id?:string;locationId:number};
 counts:{_id:string;count:number}[];
 api:{_id:{operation:string;outcome:string;model?:string;error?:string};calls:number;input:number;output:number;cost:number;unknown:number}[];
 posts:{post_id:string;metrics:string[];outcomes:string[];current?:{caption?:string;publish_status?:string;jobs?:{embed?:{status:string;error_type?:string}}}}[];
 total:number;page:number;
}

// Bounded, exact-ID investigation. Never creates indexes or modifies records.
export async function findRuns(kind:string, query:string) {
 const env=process.env;
 if(!env.AUTOMATION_IG_MONGO_URI)throw Error("configuration");
 globalMongo.mongoRead ??= new MongoClient(env.AUTOMATION_IG_MONGO_URI,{serverSelectionTimeoutMS:8000,maxPoolSize:5}).connect().catch(e=>{globalMongo.mongoRead=undefined;throw e;});
 const client=await globalMongo.mongoRead;
 const db=client.db(env.AUTOMATION_IG_STAGING_DATABASE||env.AUTOMATION_IG_MONGO_DATABASE);
 const usage=db.collection<Document & {_id:string}>(env.AUTOMATION_IG_USAGE_COLLECTION||"ig-post-lambda-usage");
 let postIds=[query];let limited=false;
 if(kind==="user"){
  const posts=await db.collection(env.AUTOMATION_IG_STAGING_COLLECTION||"ig-post-lambda-staging").find({user_id:query},{...options,projection:{post_id:1}}).sort({post_id:1}).limit(101).toArray();
  limited=posts.length>100;postIds=posts.slice(0,100).map(p=>String(p.post_id));
 }
 const links=await usage.aggregate([{$match:{post_id:{$in:postIds},record_type:{$in:["post_count","api_usage"]}}},{$group:{_id:"$run_id"}},{$sort:{_id:1}},{$limit:101}],options).toArray();
 limited ||= links.length>100;
 const runs=await usage.find({record_type:"run",_id:{$in:links.slice(0,100).map(r=>String(r._id))}},{...options,projection:{stage:1,status:1,started_at:1}}).sort({started_at:-1,_id:1}).toArray();
 return {runs,limited,note:kind==="user"?"Matches retained staging posts for this exact user ID. Removed staging records cannot be searched by user.":"Matches recorded events for this exact post ID, across report dates."};
}
