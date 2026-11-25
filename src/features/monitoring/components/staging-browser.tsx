"use client";
import {useEffect,useState} from 'react';
import type {DashboardData} from '@/features/monitoring/server/dashboard';
import type {StagingPage} from '@/features/monitoring/server/staging-page';
import {StagingPosts,type PostFilters} from '@/features/monitoring/components/staging-posts';
import {Skeleton} from '@/components/ui/skeleton';
import {Button} from '@/components/ui/button';
const cache=new Map<string,{value:StagingPage;expires:number}>();
const empty:PostFilters={postId:'',userId:'',publication:'',status:''};
export function StagingBrowser({data}:{data:DashboardData}){
 const [filters,setFilters]=useState(empty),[page,setPage]=useState(1),[retry,setRetry]=useState(0);
 const query=new URLSearchParams({source:data.source,job:data.job?._id||'',date:data.date,page:String(page),...filters}).toString();
 const key=query+':'+(data.cache?.savedAt||data.refreshedAt);
 const [result,setResult]=useState<{key:string;value:StagingPage}|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();const hit=cache.get(key);queueMicrotask(()=>setError(''));
  if(hit&&hit.expires>Date.now()){queueMicrotask(()=>setResult({key,value:hit.value}));return()=>controller.abort();}
  fetch('/api/monitoring/staging?'+query,{signal:controller.signal,cache:'no-store'}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error||'Unable to load posts');return value as StagingPage;}).then(value=>{if(controller.signal.aborted)return;cache.set(key,{value,expires:Date.now()+(data.cache?.ttlSeconds||60)*1000});while(cache.size>30)cache.delete(cache.keys().next().value!);setResult({key,value});}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();
 },[key,query,retry,data.cache?.ttlSeconds]);
 if(error)return <div className="dash-empty" role="alert">{error}<Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Retry posts</Button></div>;
 const current=result?.key===key?result.value:null;
 if(!current)return <div className="dash-panel" aria-busy="true" role="status"><h2>Loading staging posts</h2><p className="text-sm text-muted-foreground">Loading this page. Your report totals are already available.</p>{Array.from({length:4},(_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>;
 return <StagingPosts data={{...data,posts:current.posts,page:current.page,postCount:current.postCount,postCountExact:current.postCountExact}} filters={filters} onFilter={next=>{setFilters(next);setPage(1);}} onPage={setPage}/>;
}
