import {selectSnapshotDate} from "@/lib/report-selection";
import 'server-only';
import {unstable_cache,revalidateTag} from 'next/cache';
import {gzipSync,gunzipSync} from 'node:zlib';
import type {DashboardData} from '@/lib/dashboard';
import {createHash} from 'node:crypto';
import {dashboard,comparisonForSnapshot} from '@/lib/dashboard';
import type {PipelineSource} from '@/lib/pipeline-source';
const VERSION='monitor-snapshot-v15';
export function dashboardCacheKey(params:URLSearchParams,source:PipelineSource){const clean=new URLSearchParams();for(const key of ['job','date','status','page','postId','userId','publication','view']){const value=params.get(key);if(value)clean.set(key,value);}clean.sort();return source+':'+clean.toString();}
export async function cachedDashboard(params:URLSearchParams,source:PipelineSource):Promise<DashboardData>{
 if(params.get('view')==='comparison'){
  const overview=new URLSearchParams({view:'overview',date:'all'});
  if(params.get('job'))overview.set('job',params.get('job')!);
  if(params.get('refresh')==='1')overview.set('refresh','1');
  const base=await cachedDashboard(overview,source);
  if(!params.get('job')||!base.job)return base;
  const identity=createHash('sha256').update([process.env.AUTOMATION_IG_MONGO_URI,source,base.job._id,base.cache?.savedAt||base.refreshedAt].join('|')).digest('hex');
  const comparison=await unstable_cache(()=>comparisonForSnapshot(base,source),['comparison-snapshot-v2',identity],{revalidate:base.cache?.ttlSeconds||60})();
  return {...base,comparison};
 }
 const requestedDate=params.get('date')||'all';
 const normalized=new URLSearchParams(params);normalized.set('date','all');
 if(!normalized.get('view')||normalized.get('view')==='overview'){normalized.set('view','overview');for(const field of ['status','page','postId','userId','publication'])normalized.delete(field);}
 const key=dashboardCacheKey(normalized,source),tag=VERSION+':'+createHash('sha256').update(source+':'+(params.get('job')||'latest')).digest('hex');
 if(params.get('refresh')==='1')revalidateTag(tag,{expire:0});
 const query=new URLSearchParams(key.slice(source.length+1));
 const scope=createHash('sha256').update([process.env.AUTOMATION_IG_MONGO_URI,process.env.AUTOMATION_IG_MONGO_DATABASE,process.env.AUTOMATION_IG_STAGING_DATABASE,process.env.AUTOMATION_IG_USAGE_COLLECTION].join('|')).digest('hex');
 const read=unstable_cache(async()=>{const data=await dashboard(new URLSearchParams([...query,...(params.get("refresh")==="1"?[["refresh","1"]]:[])]),source);const ttlSeconds=query.get('view')!=='live'&&data.activity.state==='completed'?86400:60;return gzipSync(JSON.stringify({...data,cache:{ttlSeconds,savedAt:data.refreshedAt}})).toString('base64');},[VERSION,scope,key],{revalidate:86400,tags:[tag]});
 const unpack=(value:string)=>JSON.parse(gunzipSync(Buffer.from(value,'base64')).toString('utf8')) as DashboardData & {cache:{ttlSeconds:number;savedAt:string}};
 let result=unpack(await read());
 if(Date.now()-Date.parse(result.cache.savedAt)>=result.cache.ttlSeconds*1000){revalidateTag(tag,{expire:0});result=unpack(await read());}
 return selectSnapshotDate(result,requestedDate)||result;
}
