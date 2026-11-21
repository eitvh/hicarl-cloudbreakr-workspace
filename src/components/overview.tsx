"use client";
import type { DashboardData } from "@/lib/dashboard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { InfoTip } from "@/components/info-tip";
const fmt=(n:number)=>n.toLocaleString();
const duration=(n:number|null)=>n==null?"Not recorded":Math.floor(n/3600)+"h "+Math.floor(n%3600/60)+"m "+Math.floor(n%60)+"s";

export function Overview({data}:{data:DashboardData}){
 const job=data.job;
 const total=data.groups.reduce((n,g)=>n+g.count,0);
 const published=data.groups.filter(g=>g._id.embed==="completed"&&g._id.publish==="published").reduce((n,g)=>n+g.count,0);
 const skipped=data.groups.filter(g=>g._id.embed==="skipped").reduce((n,g)=>n+g.count,0);
 const remaining=total-published-skipped;
 const slices=[{label:"Published",value:published,color:"#b491ff"},{label:"Skipped",value:skipped,color:"#ffb56b"},{label:"Outstanding",value:remaining,color:"#ee6f91"}];

 return <div className="overview-grid">
 <Card className="overview-chart"><div className="panel-heading"><h2>Post outcomes <InfoTip text="Current staging posts linked to this job. Published and intentionally skipped posts are resolved. Cleanup can change historical counts."/></h2><Badge className={job?.source_done&&remaining===0?"api-success":"api-started"}>{job?.source_done&&remaining===0?"Completed":"Incomplete"}</Badge></div>
 <div className="outcome-total"><strong>{fmt(total)}</strong><span>retained posts in this job</span></div><div className="outcome-stack" role="img" aria-label={slices.map(s=>s.label+": "+s.value).join(", ")}>{slices.map(s=><div key={s.label} style={{width:(total?s.value/total*100:0)+"%",background:s.color}} title={s.label+": "+fmt(s.value)}/>)}</div><div className="outcome-rows">{slices.map(s=><div key={s.label}><i style={{background:s.color}}/><span><strong>{s.label}</strong><small>{s.label==="Published"?"Available in output":s.label==="Skipped"?"Intentionally excluded by the pipeline":"Pending, processing, failed, or not yet published"}</small></span><strong>{fmt(s.value)}</strong><small>{total?(s.value/total*100).toFixed(1):"0.0"}%</small></div>)}</div>
 <div className="resolution-summary"><strong>{total?((published+skipped)/total*100).toFixed(1):"0"}% resolved</strong><span>Published or intentionally skipped</span></div>
 </Card>
 <Card className="overview-checkpoint overview-insights"><div className="job-timeline"><h2>Job execution <InfoTip text="Recorded milestones for this source job. Source completion does not mean all embeddings finished."/></h2>{[["Cloudbreakr MySQL fetch",job?.created_at],["Source checkpoint complete",job?.source_finished_at],["Latest worker finished",data.timing.lastFinished]].map(([label,date])=><div key={label}><i/><span>{label}</span><strong>{date?new Date(date).toLocaleTimeString("en-GB",{timeZone:"Asia/Hong_Kong"}):"Not recorded"}</strong></div>)}</div><div className="invocation-chart"><h3>Invocation workload <InfoTip text="Recorded Lambda invocations linked to this selected source job. Fetch workers can process many posts; embedding workers handle individual posts. These are not AWS billed request totals."/></h3>{["lambda-fetch","lambda-embed"].map(stage=>{const rows=data.stageBreakdown.filter(g=>g._id.stage===stage);const count=rows.reduce((n,g)=>n+g.count,0);return <div className="workload-row" key={stage}><span>{stage==="lambda-fetch"?"Fetch workers":"Embedding workers"}</span><div className="bar-track"><div style={{width:(data.timing.runCount?count/data.timing.runCount*100:0)+"%"}}/></div><strong>{fmt(count)}</strong></div>;})}</div><div className="duration-chart"><h3>Processing time <InfoTip text="Source fetch duration and observed total span are overlapping measures, not additive. The observed span ends at the latest linked invocation finish, not a definitive job completion timestamp."/></h3>{[["MySQL fetch",data.timing.sourceSeconds],["Observed total span",data.timing.observedSeconds]].map(([name,seconds])=><div key={String(name)} className="duration-row"><span>{name}</span><div className="bar-track"><div style={{width:(data.timing.observedSeconds?Number(seconds)/data.timing.observedSeconds*100:0)+"%"}}/></div><strong>{duration(seconds as number|null)}</strong></div>)}</div></Card>
 </div>;
}
