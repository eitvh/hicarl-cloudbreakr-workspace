"use client";
import type { DashboardData } from "@/features/monitoring/server/dashboard";
import { Card } from "@/components/ui/card";

function StageStatus({status}: {status: string}) {
 const working = status === "Fetching" || status === "Processing";
 return <span className="stage-state">
   {working && <span className="stage-spinner" aria-hidden="true"/>}
   {status}
 </span>;
}

export function LatestActivity({data}:{data:DashboardData}){
 const total=data.groups.reduce((n,g)=>n+g.count,0);
 const completed=data.groups.filter(g=>g._id.embed==="completed").reduce((n,g)=>n+g.count,0);
 const skipped=data.groups.filter(g=>g._id.embed==="skipped").reduce((n,g)=>n+g.count,0);
 const failed=data.activity.failures;
 const active=["fetching","embedding","attention"].includes(data.activity.state);
 const extraction=data.jobCosts.filter(c=>c._id!=="embedding");
 const fetchCount = data.source === "fargate" ? data.syncedPostCount : data.job?.rows_scanned;
 const stages=[
 {name:"Generate embeddings",status:completed+skipped>=total&&total>0?"Finished":active&&data.activity.processing?"Processing":"Pending",percent:total?(completed+skipped)/total*100:null,detail:`${(completed+skipped).toLocaleString()} / ${total.toLocaleString()} retained posts resolved`},
 {name:"Extract content",status:extraction.length?"Activity recorded":"Not enabled",percent:null,detail:extraction.length?"No extraction progress denominator recorded":"No extraction usage for this job"}
 ];
 return <Card className="dash-panel live-workspace" data-job-state={data.activity.state}><div className="concurrent-stages">
   <section>
     <h3>Fetch posts</h3>
     <StageStatus status={data.job?.source_done?"Finished":active?"Fetching":"Unconfirmed"}/>
     <strong>{fetchCount?.toLocaleString() ?? "Not recorded"}</strong>
     <p>{data.source==="fargate"?"Unique posts synced":"Source rows scanned"}</p>
   </section>
   {stages.map(s=><section key={s.name}><h3>{s.name}</h3><StageStatus status={s.status}/><strong>{s.percent===null?'—':s.percent.toFixed(1)+'%'}</strong><div className="stage-track" role={s.percent===null?undefined:'progressbar'} aria-label={s.name} aria-valuenow={s.percent??undefined} aria-valuemin={0} aria-valuemax={100}><i style={{width:(s.percent??0)+'%'}}/></div><p>{s.detail}</p>{s.percent===null&&s.status!=='Not enabled'&&<small>Percentage unavailable</small>}</section>)}</div><div className="live-stat-grid">{[["Embedding success",completed],["Skipped",skipped],["Failed",failed],["Processing",data.activity.processing],["Retries","Not recorded"],["AI estimate",'$'+(data.jobCosts.reduce((n,c)=>n+c.estimated_usd,0)).toFixed(6)]].map(([k,v])=><div key={k}><small>{k}</small><strong>{typeof v==='number'?v.toLocaleString():v}</strong></div>)}</div><p className="live-note">Stage progress uses retained posts. The AI estimate covers recorded calls for this job.</p></Card>;
}
