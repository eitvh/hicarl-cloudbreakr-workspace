import {buildActivityReport,mergeDailyGroups,type DailyGroup,type ReportRun} from "@/lib/report-selection";
import {unstable_cache,revalidateTag} from "next/cache";
import {createHash} from "node:crypto";
import { lambdaEstimate } from "@/lib/aws-cost";
import type { PipelineSource } from "@/lib/pipeline-source";
﻿import "server-only";
import { assertMongoConfiguration } from "@/lib/mongo-diagnostics";
import { MongoClient, type Document } from "mongodb";

const globalMongo = globalThis as typeof globalThis & { mongoRead?: Promise<MongoClient> };
const options = { maxTimeMS: 15000 };
export async function collections(source: PipelineSource) {
  const env = process.env;
  const isFargate = source === "fargate";
  const isManual = source === "manual";
  const database = isManual ? "ai-vector-search-transit" : isFargate ? "ai-vector-search-benchmark-fargate" : env.AUTOMATION_IG_MONGO_DATABASE;
  const config = { AUTOMATION_IG_MONGO_DATABASE: database, AUTOMATION_IG_MONGO_URI: env.AUTOMATION_IG_MONGO_URI };
  assertMongoConfiguration(config);
  globalMongo.mongoRead ??= new MongoClient(config.AUTOMATION_IG_MONGO_URI, {
    serverSelectionTimeoutMS: 8000, maxPoolSize: 5,
  }).connect().catch(error => { globalMongo.mongoRead = undefined; throw error; });
  const client = await globalMongo.mongoRead;
  const db = client.db(isManual || isFargate ? database : env.AUTOMATION_IG_STAGING_DATABASE || database);
  return {
    state: db.collection<Document & {_id:string}>(isManual ? "ig-post-embeddings-test-state" : isFargate ? "ig-post-fargate-state" : env.AUTOMATION_IG_STATE_COLLECTION || "ig-post-lambda-state"),
    staging: db.collection(isManual ? "ig-post-embeddings-test-staging" : isFargate ? "ig-post-fargate-staging" : env.AUTOMATION_IG_STAGING_COLLECTION || "ig-post-lambda-staging"),
    usage: db.collection<Document & {_id:string}>(isManual ? "ig-post-embeddings-test-usage" : isFargate ? "ig-post-fargate-usage" : env.AUTOMATION_IG_USAGE_COLLECTION || "ig-post-lambda-usage"),
    output: client.db(database).collection(isManual ? "ig-post-embeddings-test-staging" : isFargate ? "ig-post-fargate-output" : env.AUTOMATION_IG_MONGO_COLLECTION || "ig-post-lambda-output"),
  };
}

// Fargate resumes a checkpoint for each location and date range across ingest runs.
async function fargateJobs({ state, usage }: Pick<Awaited<ReturnType<typeof collections>>, "state" | "usage">, source: PipelineSource) {
  const windows = await usage.aggregate([
    { $match: { record_type: "run", locationId: { $exists: true }, date_from: { $type: "string" }, date_until: { $type: "string" } } },
    { $group: { _id: { location: "$locationId", from: "$date_from", until: "$date_until" }, started: { $min: "$started_at" }, finished: { $max: "$finished_at" } } },
    { $sort: { started: -1 } }, { $limit: 100 },
  ], options).toArray();
  const jobs = windows.map(({ _id, started, finished }) => {
    const window = [_id.location, _id.from, _id.until].join("|");
    return { _id: (source === "manual" ? "sync-v2:ig-post-embeddings-test-staging:ig-post-embeddings-test:" : "sync-v2:ig-post-fargate-staging:ig-post-fargate-output:") + window,
      benchmark_id: source === "manual" ? "Manual ingest" : "Fargate ingest", location_id: _id.location, date_from: _id.from,
      date_until: _id.until, created_at: started, updated_at: finished, source_done: false };
  });
  const checkpoints = await state.find({ _id: { $in: jobs.map(job => job._id) } },
    { ...options, projection: { done: 1, updated_at: 1 } }).toArray();
  const byId = new Map(checkpoints.map(row => [row._id, row]));
  return jobs.map(job => {
    const checkpoint = byId.get(job._id);
    return { ...job, source_done: checkpoint?.done === true, updated_at: checkpoint?.updated_at ?? job.updated_at,
      source_finished_at: checkpoint?.done ? checkpoint.updated_at : null };
  });
}

const terminalMetrics = ["embedding_completed", "embedding_failed", "embedding_skipped", "published"];
export interface ComparisonDay {
  date: string; posts: Record<string,number>; processed: number; aws: number | null;
  operations: Record<string,{succeeded:number;failed:number;input:number;output:number;cost:number;unknown:number}>;
  first: string|null; last: string|null;
}
async function comparisonDays(usage: Awaited<ReturnType<typeof collections>>["usage"], ids: string[], runs: Document[], source: PipelineSource) {
  const counts = await usage.aggregate([
    {$match:{record_type:"post_count",run_id:{$in:ids},reporting_date_my:{$type:"string"},post_id:{$type:"string"},metric:{$in:terminalMetrics}}},
    {$set:{comparison_dates:["$reporting_date_my","all"]}},{$unwind:"$comparison_dates"},
    {$group:{_id:{date:"$comparison_dates",post:"$post_id"}}},
    {$group:{_id:{date:"$_id.date",metric:{$literal:"__processed"}},count:{$sum:1}}}
  ], options).toArray();
  const days = new Map<string, ComparisonDay>();
  function day(date:string) {
    const row:ComparisonDay = days.get(date) ?? {date,posts:{},processed:0,aws:null,operations:{},first:null,last:null};
    days.set(date,row);
    return row;
  }
  for (const entry of counts) {
    const row = day(entry._id.date);
    if (entry._id.metric === "__processed") row.processed = entry.count;
    else row.posts[entry._id.metric] = entry.count;
  }
  const activity = await usage.aggregate([
    {$match:{run_id:{$in:ids},record_type:{$in:['post_count','api_usage']},reporting_date_my:{$type:'string'}}},
    {$set:{comparison_dates:['$reporting_date_my','all']}},{$unwind:'$comparison_dates'},
    {$group:{_id:{date:'$comparison_dates',type:'$record_type',metric:'$metric',operation:'$operation',outcome:'$outcome'},count:{$sum:1},input:{$sum:'$input_tokens'},output:{$sum:'$output_tokens'},cost:{$sum:'$estimated_cost_usd'},unknown:{$sum:{$cond:[{$eq:[{$ifNull:['$estimated_cost_usd',null]},null]},1,0]}},first:{$min:'$recorded_at'},last:{$max:'$recorded_at'}}}
  ],options).toArray();
  for(const entry of activity){const row=day(entry._id.date);if(entry.first&&(!row.first||new Date(entry.first)<new Date(row.first)))row.first=new Date(entry.first).toISOString();if(entry.last&&(!row.last||new Date(entry.last)>new Date(row.last)))row.last=new Date(entry.last).toISOString();
    if(entry._id.type==='post_count'&&entry._id.metric)row.posts[entry._id.metric]=entry.count;
    if(entry._id.type==='api_usage'){const op=entry._id.operation||'unknown';const api=row.operations[op]??={succeeded:0,failed:0,input:0,output:0,cost:0,unknown:0};if(entry._id.outcome==='api_succeeded')api.succeeded+=entry.count;if(entry._id.outcome==='api_failed')api.failed+=entry.count;api.input+=entry.input;api.output+=entry.output;api.cost+=entry.cost;api.unknown+=entry.unknown;}
  }
  for (const run of runs) {
    const start = new Date(run.started_at).getTime();
    if (!run.started_at || !Number.isFinite(start)) continue;
    const row = day(new Date(start + 8*3600000).toISOString().slice(0,10));
    const seconds = (new Date(run.finished_at).getTime()-start)/1000;
    if (!run.finished_at || !Number.isFinite(seconds) || seconds < 0) continue;
    if(source==="manual")continue;
    const cost = source === "lambda" ? lambdaEstimate(seconds,1,"x86").total
      : Math.max(60,Math.ceil(seconds))/3600 * (2*0.05056 + 4*0.00553);
    row.aws = (row.aws ?? 0) + cost;
    const total=day("all");total.aws=(total.aws??0)+cost;
  }
  return [...days.values()];
}

export async function dashboard(params: URLSearchParams, source: PipelineSource = "lambda") {
  const options={maxTimeMS:source==="manual"?45000:15000};
  const { state, staging, usage, output } = await collections(source);
  const costDetails=params.get("view")==="cost";
  const metadataScope=createHash('sha256').update([process.env.AUTOMATION_IG_MONGO_URI,usage.namespace,source].join('|')).digest('hex');
  const metadataTag='dashboard-metadata-v1:'+metadataScope;
  if(params.get('refresh')==='1')revalidateTag(metadataTag,{expire:0});
  const metadata=<T,>(key:string,read:()=>Promise<T>)=>unstable_cache(read,['dashboard-metadata-v1',metadataScope,key],{revalidate:60,tags:[metadataTag]})();
  const [jobs, dates, outputCount, stagingCount] = await metadata("catalog",()=>Promise.all([
    source !== "lambda" ? fargateJobs({state, usage},source) : state.find({ record_type: "source_job" }, { ...options, projection: { benchmark_id:1, location_id:1, date_from:1, date_until:1, rows_scanned:1, source_done:1, created_at:1, updated_at:1, source_finished_at:1, "cursor.user_done":1 } }).sort({ created_at:-1 }).limit(100).toArray(),
    usage.aggregate([{$match:{record_type:{$in:["run","post_count","api_usage"]},reporting_date_my:{$type:"string"}}},{$group:{_id:"$reporting_date_my"}},{$sort:{_id:-1}}],options).toArray(),
    source === "manual" ? staging.aggregate([{$project:{_id:0,publish_status:1}},{$group:{_id:null,count:{$sum:{$cond:[{$eq:["$publish_status","published"]},1,0]}}}}],{...options,hint:"locationId_1_publish_status_1_jobs.embed.status_1_published_at_1__id_1"}).toArray().then(rows=>rows[0]?.count||0) : output.countDocuments({},options),
    staging.countDocuments({},{...options,hint:"_id_"}),
  ]));
  const dateValues = dates.map(d=>String(d._id));
  const finishedValues: string[] = [];
  const requestedDate = params.get("date") || "all";
  const date = requestedDate === "all" ? "all" : dateValues.includes(requestedDate) ? requestedDate : dateValues[0] || "";
  const finished = "";
  const retainedByJob=source !== "lambda" ? [] : await staging.aggregate([{$match:{workflow_ids:{$in:jobs.map(j=>String(j._id))}}},{$unwind:"$workflow_ids"},{$group:{_id:"$workflow_ids",retained:{$sum:1},outstanding:{$sum:{$cond:[{$or:[{$eq:["$jobs.embed.status","skipped"]},{$and:[{$eq:["$jobs.embed.status","completed"]},{$eq:["$publish_status","published"]}]}]},0,1]}}}}],options).toArray();
  const selectableJobs=source !== "lambda" ? jobs : jobs.filter(j=>j.source_done&&retainedByJob.some(g=>g._id===String(j._id)&&g.retained>0&&g.outstanding===0));
  const job=params.get("view")==="live"?jobs[0]:selectableJobs.find(j=>String(j._id)===params.get("job"))||selectableJobs[0];
  const status = ["pending","processing","completed","failed","skipped"].includes(params.get("status") || "") ? params.get("status")! : "";
  const runMatch = source !== "lambda"
    ? { locationId: job?.location_id, date_from: job?.date_from, date_until: job?.date_until }
    : { job_id: job ? String(job._id) : "__none__" };
  const jobRuns = job ? await metadata("job-runs:"+JSON.stringify(runMatch),()=>usage.find({record_type:"run", ...runMatch}, {
    ...options, projection:{_id:1,stage:1,started_at:1,finished_at:1,status:1}
  }).toArray()) : [];
  const jobRunIds = jobRuns.map(run=>run._id);
  // Share expensive grouped reports across overview, costs, staging and pagination.
  const reportScope=createHash('sha256').update([process.env.AUTOMATION_IG_MONGO_URI,usage.namespace,source].join('|')).digest('hex');
  const reportTag='usage-rollups-v1:'+reportScope;
  if(params.get('refresh')==='1')revalidateTag(reportTag,{expire:0});
  const stableReport=!!job?.source_done&&jobRuns.length>0&&jobRuns.every(r=>!!r.finished_at);
  const dailyRows:Record<string,DailyGroup[]>={};
  const rollup=(pipeline:Document[])=>({toArray:async()=>{
    const match={...pipeline[0].$match};const selectedDate=match.reporting_date_my;delete match.reporting_date_my;
    const group=pipeline[1].$group;
    const dailyPipeline=[{$match:match},{$group:{...group,_id:{key:group._id,day:'$reporting_date_my'}}}];
    const daily=await unstable_cache(async()=>usage.aggregate(dailyPipeline,options).toArray(),['usage-daily-rollups-v2',reportScope,JSON.stringify(jobRuns.map(r=>[r._id,r.status,r.finished_at])),JSON.stringify(dailyPipeline)],{revalidate:stableReport?86400:60,tags:[reportTag]})();
    const bucket=group._id?.type?'events':group._id?.outcome&&match.operation==='embedding'?'costs':group._id?.outcome&&match.operation==='extraction'?'extraction':null;
    if(bucket)dailyRows[bucket]=daily as DailyGroup[];
    return mergeDailyGroups(daily as DailyGroup[],selectedDate||'all') as Document[];
  }});

  const comparison = params.get("view") === "comparison" && job && params.get("job") === String(job._id)
    ? await comparisonDays(usage, jobRunIds, jobRuns, source) : [];
  const filter = source === "manual" ? {locationId:job?.location_id??-1} : source === "fargate"
    ? { post_id: { $in: await usage.distinct("post_id", { run_id: { $in: jobRunIds }, post_id: { $type: "string" } }, options) } }
    : {workflow_ids:job?String(job._id):"__no_selected_job__"};
  const postId=(params.get("postId")||"").trim(),userId=(params.get("userId")||"").trim();
  if((postId&&!/^\d{1,30}$/.test(postId))||(userId&&!/^\d{1,30}$/.test(userId)))throw Error("Invalid identifier");

  const costMatch: Document = {record_type:"api_usage",operation:"embedding",run_id:{$in:jobRunIds},...(date==="all"?{}:{reporting_date_my:date})};
  const groupFields = {
    count:{$sum:1},input_tokens:{$sum:"$input_tokens"},output_tokens:{$sum:"$output_tokens"},
    estimated_usd:{$sum:"$estimated_cost_usd"},
    unknown_cost_calls:{$sum:{$cond:[{$eq:[{$ifNull:["$estimated_cost_usd",null]},null]},1,0]}},
  };
  const stagingPage = Promise.resolve({page:1,posts:[],postCount:0});
  const [{page,posts,postCount},groups,,costs,syncedPosts] = await Promise.all([
    stagingPage,
    metadata("staging-groups:"+JSON.stringify(filter),()=>staging.aggregate([{$match:filter},{$project:{_id:0,"jobs.embed.status":1,publish_status:1}},{$group:{_id:{embed:"$jobs.embed.status",publish:"$publish_status"},count:{$sum:1}}}],source === "manual" ? {...options,hint:"locationId_1_publish_status_1_jobs.embed.status_1_published_at_1__id_1"}:options).toArray()),
    rollup([{$match:{run_id:{$in:jobRunIds},...(date==="all"?{}:{reporting_date_my:date}),record_type:{$in:["post_count","api_usage"]}}},{$group:{_id:{run_id:"$run_id",type:"$record_type",metric:"$metric",operation:"$operation",outcome:"$outcome"},...groupFields}}]).toArray(),
    rollup([{$match:costMatch},{$group:{_id:{outcome:"$outcome",pricing:"$pricing.version",source:"$usage_source"},...groupFields}}]).toArray(),
    source !== "lambda" && params.get("view")==="live" ? usage.aggregate<{count:number}>([
      {$match:{record_type:"post_count", metric:"synced", run_id:{$in:jobRunIds}, post_id:{$type:"string"}}},
      {$group:{_id:"$post_id"}},
      {$count:"count"},
    ], options).toArray() : [],
  ]);
  const runDocs=await usage.find({record_type:'run',_id:{$in:jobRunIds}},{...options,projection:{stage:1,status:1,locationId:1,reporting_date_my:1}}).toArray();
  const report=buildActivityReport(dailyRows.events||[],runDocs as unknown as ReportRun[],date);
  const lastFinished = jobRuns.map(r=>r.finished_at).filter(Boolean).sort((a,b)=>new Date(b).getTime()-new Date(a).getTime())[0] || null;
  const extractionMatch = {record_type:"api_usage",operation:"extraction",run_id:{$in:jobRunIds},...(date==="all"?{}:{reporting_date_my:date})};
  const [extraction, apiDetails, overallCosts, timeline, stageBreakdown, jobCosts] = await Promise.all([
    rollup([{$match:extractionMatch},{$group:{_id:{outcome:"$outcome",pricing:"$pricing.version",source:"$usage_source"},...groupFields}}]).toArray(),
    costDetails ? usage.aggregate([{$match:costMatch},{$sort:{recorded_at:-1}},{$facet:{
      api_succeeded:[{$match:{outcome:"api_succeeded"}},{$limit:25},{$project:{post_id:1,run_id:1,model:1,recorded_at:1,finished_at:1,input_tokens:1,output_tokens:1,estimated_cost_usd:1,error_type:1,usage_source:1}}],
      api_failed:[{$match:{outcome:"api_failed"}},{$limit:25},{$project:{post_id:1,run_id:1,model:1,recorded_at:1,finished_at:1,input_tokens:1,output_tokens:1,estimated_cost_usd:1,error_type:1,usage_source:1}}],
      started:[{$match:{outcome:"started"}},{$limit:25},{$project:{post_id:1,run_id:1,model:1,recorded_at:1,finished_at:1,input_tokens:1,output_tokens:1,estimated_cost_usd:1,error_type:1,usage_source:1}}]
    }}],options).toArray() : Promise.resolve([] as Document[]),
    Promise.resolve([] as Document[]),
    costDetails ? usage.aggregate([{$match:{record_type:"api_usage",run_id:{$in:jobRunIds},...(date==="all"?{}:{reporting_date_my:date}),recorded_at:{$type:"date"}}},{$group:{_id:{$dateToString:{date:"$recorded_at",format:"%Y-%m-%dT%H:%M:00",timezone:"Asia/Kuala_Lumpur"}},calls:{$sum:1},tokens:{$sum:"$input_tokens"},cost:{$sum:"$estimated_cost_usd"},failed:{$sum:{$cond:[{$eq:["$outcome","api_failed"]},1,0]}}}},{$sort:{_id:1}}],options).toArray() : Promise.resolve([] as Document[]),
    usage.aggregate([{$match:{record_type:"run",_id:{$in:jobRunIds}}},{$group:{_id:{stage:"$stage",status:"$status"},count:{$sum:1}}}],options).toArray(),
    rollup([{$match:{record_type:"api_usage",run_id:{$in:jobRunIds}}},{$group:{_id:"$operation",...groupFields}}]).toArray()
  ]);
  const dailyReports:NonNullable<DashboardData['dailyReports']>={};
  const reportDates=new Set(['all',...dateValues,...Object.values(dailyRows).flatMap(rows=>rows.map(r=>r._id.day).filter((d):d is string=>typeof d==='string')),...runDocs.map(r=>r.reporting_date_my).filter((d):d is string=>typeof d==='string')]);
  for(const day of reportDates)dailyReports[day]={report:buildActivityReport(dailyRows.events||[],runDocs as unknown as ReportRun[],day),costs:mergeDailyGroups(dailyRows.costs||[],day) as unknown as DashboardData['costs'],extraction:mergeDailyGroups(dailyRows.extraction||[],day) as unknown as DashboardData['extraction']};
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

  const latestEvent = jobRunIds.length ? await metadata("latest-event:"+JSON.stringify(jobRunIds),()=>usage.findOne(
    {run_id: {$in: jobRunIds}, recorded_at: {$type:"date"}},
    {...options, sort:{recorded_at:-1}, projection:{recorded_at:1}}
  )) : null;
  const lastActivity = [latestEvent?.recorded_at,job?.updated_at,job?.source_finished_at,lastFinished,...jobRuns.map(r=>r.started_at)].filter(Boolean).sort((a,b)=>new Date(b).getTime()-new Date(a).getTime())[0] || null;
  const outstanding = groups.filter(g=>!(g._id.embed==="completed"&&g._id.publish==="published")&&g._id.embed!=="skipped").reduce((n,g)=>n+g.count,0);
  const recent = (source!=="manual"||jobRuns.some(r=>r.status==="running"&&!r.finished_at)) && lastActivity && Date.now()-new Date(lastActivity).getTime()<5*60*1000;
  const failures = groups.filter(g=>g._id.embed==="failed").reduce((n,g)=>n+g.count,0);
  const activity = {
    state:!job?"idle":job.source_done&&outstanding===0&&groups.length>0&&timing.unfinishedRuns===0?"completed":!recent?"stale":failures?"attention":!job.source_done?"fetching":"embedding",
    lastActivity, outstanding, failures,
    processing:groups.filter(g=>g._id.embed==="processing").reduce((n,g)=>n+g.count,0),
    pending:groups.filter(g=>g._id.embed==="pending").reduce((n,g)=>n+g.count,0)
  };
  // Plain DTOs only: no vectors, connection metadata, raw errors, or worker tokens.
  return JSON.parse(JSON.stringify({
    dailyReports, postCountExact:false, comparison, syncedPostCount:syncedPosts[0]?.count ?? 0,
    source,jobs:params.get("view")==="live"?jobs:selectableJobs,job:job || null,lastJob:jobs[0] || null,dates:dateValues,finishedDates:finishedValues,
    date,finished,status,page,outputCount,stagingCount,groups,posts,postCount,costs,report,extraction,timing,jobCosts,overallCosts,timeline,stageBreakdown,activity,apiDetails:apiDetails[0] || {},
    refreshedAt:new Date().toISOString(),
  })) as DashboardData;
}
export interface Job { _id:string; benchmark_id:string;location_id:number;date_from:string;date_until:string;rows_scanned:number;source_done:boolean;created_at:string;updated_at?:string;source_finished_at?:string;cursor?:{user_done:boolean} }
export interface ApiTotals {count:number;input_tokens:number;output_tokens:number;estimated_usd:number;unknown_cost_calls:number}
export interface Run {run_id:string;stage:string;status:string;locationId:number|null;counts:Record<string,number>;api:Record<string,Record<string,ApiTotals>>}
export interface ApiDetail { _id:string;post_id:string;run_id:string;model?:string;recorded_at:string;finished_at?:string;input_tokens?:number;output_tokens?:number;estimated_cost_usd?:number|null;error_type?:string;usage_source?:string;currentPost?:{publish_status?:string;jobs?:{embed?:{status?:string;attempts?:number}}};laterAttempt?:{recorded_at:string;outcome:string;run_id:string;error_type?:string}|null }
export interface DashboardData {
 dailyReports?:Record<string,Pick<DashboardData,"report"|"costs"|"extraction">>;
 cache?:{ttlSeconds:number;savedAt:string};
 postCountExact?:boolean;
 comparison:ComparisonDay[];
 syncedPostCount: number;
 source: PipelineSource;
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

export async function inspectRun(id: string, page = 1, source: PipelineSource = "lambda") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const { usage, staging } = await collections(source);
  // UUIDs are stored as strings in the Python usage collection.
  const run=await usage.findOne({record_type:"run",_id:id},{...options,projection:{stage:1,status:1,started_at:1,finished_at:1,job_id:1,aws_request_id:1,benchmark_id:1,locationId:1,date_from:1,date_until:1}});
  if(!run)return null;
  const [counts,api,linked] = await Promise.all([
    usage.aggregate([{$match:{run_id:id,record_type:"post_count"}},{$group:{_id:"$metric",count:{$sum:1}}}],options).toArray(),
    usage.aggregate([{$match:{run_id:id,record_type:"api_usage"}},{$group:{_id:{operation:"$operation",outcome:"$outcome",model:"$model",error:"$error_type"},calls:{$sum:1},input:{$sum:"$input_tokens"},output:{$sum:"$output_tokens"},cost:{$sum:"$estimated_cost_usd"},unknown:{$sum:{$cond:[{$eq:[{$ifNull:["$estimated_cost_usd",null]},null]},1,0]}}}}],options).toArray(),
    usage.aggregate([{$match:{run_id:id,record_type:{$in:["api_usage","post_count"]},post_id:{$type:"string"}}},{$group:{_id:"$post_id",metrics:{$addToSet:"$metric"},outcomes:{$addToSet:"$outcome"}}},{$sort:{_id:1}},{$facet:{
      total:[{$count:"count"}],
      posts:[{$skip:(page-1)*3},{$limit:3},{$lookup:{from:staging.collectionName,localField:"_id",foreignField:"post_id",pipeline:[{$project:{_id:0,caption:1,publish_status:1,"jobs.embed.status":1,"jobs.embed.error_type":1}}],as:"current"}},{$project:{post_id:"$_id",_id:0,metrics:1,outcomes:1,current:{$arrayElemAt:["$current",0]}}}]
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
export async function findRuns(kind:string, query:string, source: PipelineSource = "lambda") {
  const { usage, staging } = await collections(source);
 let postIds=[query];let limited=false;
 if(kind==="user"){
  const posts=await staging.find({user_id:query},{...options,projection:{post_id:1}}).sort({post_id:1}).limit(101).toArray();
  limited=posts.length>100;postIds=posts.slice(0,100).map(p=>String(p.post_id));
 }
 const links=await usage.aggregate([{$match:{post_id:{$in:postIds},record_type:{$in:["post_count","api_usage"]}}},{$group:{_id:"$run_id"}},{$sort:{_id:1}},{$limit:101}],options).toArray();
 limited ||= links.length>100;
 const runs=await usage.find({record_type:"run",_id:{$in:links.slice(0,100).map(r=>String(r._id))}},{...options,projection:{stage:1,status:1,started_at:1}}).sort({started_at:-1,_id:1}).toArray();
 return {runs,limited,note:kind==="user"?"Matches retained staging posts for this exact user ID. Removed staging records cannot be searched by user.":"Matches recorded events for this exact post ID, across report dates."};
}

// Comparison adds only its distinct-post/timing metrics to a cached overview.
export async function comparisonForSnapshot(data:DashboardData,source:PipelineSource){
 const {usage}=await collections(source);
 const ids=data.report.runs.map(run=>run.run_id);
 const runs=await usage.find({_id:{$in:ids},record_type:'run'},{...options,projection:{started_at:1,finished_at:1}}).toArray();
 return comparisonDays(usage,ids,runs,source);
}
