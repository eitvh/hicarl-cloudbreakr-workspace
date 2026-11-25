import {NextRequest,NextResponse} from 'next/server';
import {unstable_cache} from 'next/cache';
import {pipelineSource} from '@/features/monitoring/lib/pipeline-source';
import {jobContext} from '@/features/monitoring/server/staging-page';
import {mongoFailure} from '@/lib/mongo-diagnostics';
export const maxDuration=60;
export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams,source=pipelineSource(p.get('source')),job=p.get('job')||'',date=p.get('date')||'all',outcome=p.get('outcome')||'';
 if(!source||!['api_succeeded','api_failed','started'].includes(outcome)||(date!=='all'&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))return NextResponse.json({error:'Invalid API detail filter.'},{status:400});
 try{
  const {context,usage,staging,options,cacheScope,tag}=await jobContext(job,source);
  const calls=await unstable_cache(async()=>{
   const calls=await usage.find({record_type:'api_usage',operation:'embedding',run_id:{$in:context.ids},outcome,...(date==='all'?{}:{reporting_date_my:date})},{...options,projection:{post_id:1,run_id:1,model:1,recorded_at:1,finished_at:1,input_tokens:1,output_tokens:1,estimated_cost_usd:1,error_type:1,usage_source:1}}).sort({recorded_at:-1}).limit(25).toArray();
   if(outcome==='api_failed'&&calls.length){const ids=calls.map(c=>c.post_id);const [posts,later]=await Promise.all([
    staging.find({post_id:{$in:ids}},{...options,projection:{post_id:1,publish_status:1,'jobs.embed.status':1,'jobs.embed.attempts':1}}).toArray(),
    usage.aggregate([{$match:{record_type:'api_usage',operation:'embedding',post_id:{$in:ids}}},{$sort:{recorded_at:-1}},{$group:{_id:'$post_id',latest:{$first:{recorded_at:'$recorded_at',outcome:'$outcome',run_id:'$run_id',error_type:'$error_type'}}}}],options).toArray()
   ]);for(const call of calls){call.currentPost=posts.find(p=>p.post_id===call.post_id);const latest=later.find(p=>p._id===call.post_id)?.latest;call.laterAttempt=latest&&new Date(latest.recorded_at)>new Date(call.recorded_at)?latest:null;}}
   return JSON.parse(JSON.stringify(calls));
  },['api-calls-v1',cacheScope,job,date,outcome,JSON.stringify(context.signature)],{revalidate:context.stable?86400:60,tags:[tag]})();
  return NextResponse.json({calls},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const failure=mongoFailure(error);return NextResponse.json({error:failure.code+': '+failure.hint},{status:503});}
}
