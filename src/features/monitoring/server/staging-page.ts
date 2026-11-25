import 'server-only';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {unstable_cache,revalidateTag} from 'next/cache';
import type {Document} from 'mongodb';
import {collections,type DashboardData} from '@/features/monitoring/server/dashboard';
import type {PipelineSource} from '@/features/monitoring/lib/pipeline-source';

export const STAGING_PAGE_SIZE=4;
export type StagingPage=Pick<DashboardData,'posts'|'page'|'postCount'|'postCountExact'> & {job:string;date:string;hasMore:boolean};
type Membership={packed:Buffer;expires:number};
// Bounded per-instance membership cache; concurrent requests share the initial read.
const memberships=new Map<string,Membership>();
const pending=new Map<string,Promise<Membership>>();
const generations=new Map<string,number>();
const MAX_BYTES=16*1024*1024;
function scope(source:PipelineSource){return createHash('sha256').update([process.env.AUTOMATION_IG_MONGO_URI,process.env.AUTOMATION_IG_STAGING_DATABASE,process.env.AUTOMATION_IG_USAGE_COLLECTION,source].join('|')).digest('hex');}
export function invalidateStaging(source:PipelineSource){const prefix=scope(source);generations.set(prefix,(generations.get(prefix)||0)+1);for(const key of memberships.keys())if(key.startsWith(prefix))memberships.delete(key);revalidateTag('staging-pages-v1:'+prefix,{expire:0});}
export async function stagingPosts(params:URLSearchParams,source:PipelineSource):Promise<StagingPage>{
 const job=params.get('job')||'',date=params.get('date')||'all';
 if(!job||job.length>500||(date!=='all'&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw Error('Invalid staging scope');
 const page=Number(params.get('page')||1);
 if(!Number.isSafeInteger(page)||page<1||page>100000)throw Error('Invalid page');
 const postId=params.get('postId')||'',userId=params.get('userId')||'',status=params.get('status')||'',publication=params.get('publication')||'';
 if((postId&&!/^\d{1,30}$/.test(postId))||(userId&&!/^\d{1,30}$/.test(userId))||!["","pending","processing","completed","failed","skipped"].includes(status)||!["","pending","published","failed","skipped"].includes(publication))throw Error('Invalid post filter');
 const {staging,usage,options,cacheScope,tag,location,context}=await jobContext(job,source);
 const ttl=context.stable?86400:60;
 const identity=cacheScope+':'+createHash('sha256').update(JSON.stringify([job,context.signature,generations.get(cacheScope)||0])).digest('hex');
 const readMembership=async()=>{
  const hit=memberships.get(identity);if(hit&&hit.expires>Date.now())return hit;
  if(pending.has(identity))return pending.get(identity)!;
  const task=(async()=>{
   const rows=await usage.aggregate<{_id:string;days:string[]}>([
    {$match:{run_id:{$in:context.ids},record_type:{$in:['post_count','api_usage']},post_id:{$type:'string'}}},
    {$group:{_id:'$post_id',days:{$addToSet:'$reporting_date_my'}}}
   ],options).toArray();
   rows.sort((a,b)=>a._id.localeCompare(b._id));
   const result={packed:gzipSync(JSON.stringify(rows)),expires:Date.now()+ttl*1000};
   for(const [key,value] of memberships)if(value.expires<=Date.now())memberships.delete(key);
   if(result.packed.length<=MAX_BYTES){memberships.set(identity,result);while([...memberships.values()].reduce((n,v)=>n+v.packed.length,0)>MAX_BYTES)memberships.delete(memberships.keys().next().value!);}
   return result;
  })();pending.set(identity,task);try{return await task;}finally{pending.delete(identity);}
 };
 const key=JSON.stringify([identity,date,page,postId,userId,status,publication]);
 const read=unstable_cache(async()=>{
  if(!context.ids.length)return {posts:[],page,postCount:0,postCountExact:false,job,date,hasMore:false};
  const membership=JSON.parse(gunzipSync((await readMembership()).packed).toString('utf8')) as {_id:string;days:string[]}[];
  let ids=membership.filter(row=>date==='all'||row.days.includes(date)).map(row=>row._id);
  if(postId)ids=ids.filter(id=>id===postId);
  const filters:Document={...(location!==undefined?{locationId:location}:{}),...(userId?{user_id:userId}:{}),...(status?{'jobs.embed.status':status}:{}),...(publication?{publish_status:publication}:{}),...(postId?{post_id:postId}:{})};
  if(userId||status||publication){
   const candidates=await staging.find(filters,{...options,projection:{_id:0,post_id:1}}).toArray();
   const allowed=new Set(candidates.map(p=>p.post_id));ids=ids.filter(id=>allowed.has(id));
  }
  const projection={post_id:1,user_id:1,caption:1,created_at:1,synced_at:1,published_at:1,embedding_model:1,'jobs.embed.status':1,'jobs.embed.attempts':1,'jobs.embed.error_type':1,'jobs.embed.reason':1,publish_status:1};
  const posts:Document[]=[];let skipped=0;
  for(let offset=0;offset<ids.length&&posts.length<=STAGING_PAGE_SIZE;offset+=128){
   const batch=ids.slice(offset,offset+128);
   const found=await staging.find({...filters,post_id:{$in:batch}},{...options,projection}).toArray();
   const byId=new Map(found.map(p=>[p.post_id,p]));
   for(const id of batch){const post=byId.get(id);if(!post)continue;if(skipped<(page-1)*STAGING_PAGE_SIZE){skipped++;continue;}posts.push(post);if(posts.length>STAGING_PAGE_SIZE)break;}
  }
  return JSON.parse(JSON.stringify({posts:posts.slice(0,STAGING_PAGE_SIZE),page,postCount:(page-1)*STAGING_PAGE_SIZE+posts.length,postCountExact:false,job,date,hasMore:posts.length>STAGING_PAGE_SIZE}));
 },['staging-page-v1',key],{revalidate:ttl,tags:[tag]});
 return read();
}

export async function jobContext(job:string,source:PipelineSource){
 if(!job||job.length>500)throw Error('Invalid job');
 const {state,staging,usage}=await collections(source);
 const options={maxTimeMS:source==='manual'?45000:15000};
 const cacheScope=scope(source),tag='staging-pages-v1:'+cacheScope;
 let runMatch:Document,location:number|undefined;
 if(source==='lambda')runMatch={job_id:job};
 else{
  const prefix=source==='manual'?'sync-v2:ig-post-embeddings-test-staging:ig-post-embeddings-test:':'sync-v2:ig-post-fargate-staging:ig-post-fargate-output:';
  if(!job.startsWith(prefix))throw Error('Invalid job');
  const parts=job.slice(prefix.length).split('|');
  if(parts.length!==3||!/^\d+$/.test(parts[0])||!parts.slice(1).every(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)))throw Error('Invalid source window');
  location=Number(parts[0]);runMatch={locationId:location,date_from:parts[1],date_until:parts[2]};
 }
 const context=await unstable_cache(async()=>{
  const [runs,checkpoint]=await Promise.all([
   usage.find({record_type:'run',...runMatch},{...options,projection:{_id:1,status:1,finished_at:1}}).toArray(),
   state.findOne({_id:job},{...options,projection:{done:1,source_done:1}})
  ]);
  return {ids:runs.map(r=>String(r._id)),signature:runs.map(r=>[r._id,r.status,r.finished_at]),stable:!!(checkpoint?.done||checkpoint?.source_done)&&runs.length>0&&runs.every(r=>!!r.finished_at)};
 },['staging-context-v1',cacheScope,job],{revalidate:60,tags:[tag]})();

 return {state,staging,usage,options,cacheScope,tag,location,context};
}
