"use client";
import type { DashboardData } from "@/lib/dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export function LatestActivity({data,onRefresh,pending,demoMode=false,demoTick=0}:{data:DashboardData;onRefresh:()=>void;pending:boolean;demoMode?:boolean;demoTick?:number}){
 const active=["fetching","embedding","attention"].includes(data.activity.state);
 if(!demoMode&&!active)return <Card className="dash-panel live-empty"><h2>No live automation detected</h2><p>No recent active-job evidence at the last refresh.</p><Button onClick={onRefresh} disabled={pending}>Check again</Button></Card>;
 const total=demoMode?7250+(demoTick%10)*20:data.groups.reduce((n,g)=>n+g.count,0);
 const completed=demoMode?4140+(demoTick%10)*17:data.groups.filter(g=>g._id.embed==="completed").reduce((n,g)=>n+g.count,0);
 const skipped=demoMode?240:data.groups.filter(g=>g._id.embed==="skipped").reduce((n,g)=>n+g.count,0);
 const failed=demoMode?2:data.activity.failures;
 const extraction=data.jobCosts.filter(c=>c._id!=="embedding");
 const stages=[
 {name:"Fetch posts",status:demoMode?"Fetching":data.job?.source_done?"Finished":"Fetching",percent:demoMode?total/10000*100:data.job?.source_done?100:null,detail:demoMode?`${total.toLocaleString()} / 10,000 source posts`:`${Number(data.job?.rows_scanned||0).toLocaleString()} rows scanned; ${data.job?.source_done?'source finished':'source total not recorded'}`},
 {name:"Generate embeddings",status:completed+skipped>=total&&total>0?"Finished":"Processing",percent:total?(completed+skipped)/total*100:null,detail:`${(completed+skipped).toLocaleString()} / ${total.toLocaleString()} retained posts resolved`},
 {name:"Extract content",status:demoMode?"Processing":extraction.length?"Activity recorded":"Not enabled",percent:demoMode?45+(demoTick%10):null,detail:demoMode?`${1863+(demoTick%10)*41} / 4,140 eligible posts (dummy)`:extraction.length?"No extraction progress denominator recorded":"No extraction usage for this job"}
 ];
 return <Card className="dash-panel live-workspace"><div className="live-top"><div><span className="live-eyebrow">{demoMode?"LIVE SIMULATION | 21/11/2026 (DUMMY)":"RECENT AUTOMATION ACTIVITY"}</span><h2>Pipeline progress</h2><p>{demoMode?"Concurrent stages using sample data only.":"Snapshot from MongoDB; refresh to check changes."}</p></div><Button variant="outline" onClick={onRefresh} disabled={pending}>{pending?'Refreshing...':'Refresh'}</Button></div><div className="concurrent-stages">{stages.map((s,i)=><section key={s.name}><small>STAGE 0{i+1}</small><h3>{s.name}</h3><span className="stage-state">{s.status}</span><strong>{s.percent===null?'—':s.percent.toFixed(1)+'%'}</strong><div className="stage-track" role={s.percent===null?undefined:'progressbar'} aria-label={s.name} aria-valuenow={s.percent??undefined} aria-valuemin={0} aria-valuemax={100}><i style={{width:(s.percent??0)+'%'}}/></div><p>{s.detail}</p>{s.percent===null&&s.status!=='Not enabled'&&<small>Percentage unavailable</small>}</section>)}</div><div className="live-stat-grid">{[["Embedding success",completed],["Skipped",skipped],["Failed",failed],["Processing",demoMode?24:data.activity.processing],["Retries",demoMode?"2 retrying":"Not recorded"],["AI estimate",'$'+(demoMode?.092:data.jobCosts.reduce((n,c)=>n+c.estimated_usd,0)).toFixed(6)]].map(([k,v])=><div key={k}><small>{k}</small><strong>{typeof v==='number'?v.toLocaleString():v}</strong></div>)}</div><p className="live-note">{demoMode?"Dummy preview: refresh advances sample progress. No AWS or MongoDB requests.":"Stages can overlap. Embedding percentage uses retained posts and can change while fetching continues. No worker heartbeat; recent records do not guarantee workers are still running."}</p></Card>;
}
