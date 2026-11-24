"use client";
import { jobStatus } from "@/lib/pipeline-source";
import type { DashboardData } from "@/lib/dashboard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { InfoTip } from "@/components/info-tip";
const fmt=(n:number)=>n.toLocaleString();
const duration=(n:number|null)=>n==null?"Not recorded":Math.floor(n/3600)+"h "+Math.floor(n%3600/60)+"m "+Math.floor(n%60)+"s";

export function Overview({data}:{data:DashboardData}){
 const job=data.job;
 const isFargate=data.source==="fargate";
 const executionRows=isFargate
  ? [["Overall (observed)",job?.created_at,data.timing.lastFinished,data.timing.observedSeconds]]
  : [["Fetch posts",job?.created_at,job?.source_finished_at,data.timing.sourceSeconds],["Embeddings",data.timing.embedStarted,data.timing.embedFinished,data.timing.embedSeconds],["Overall (observed)",job?.created_at,data.timing.lastFinished,data.timing.observedSeconds]];
 const total=data.groups.reduce((n,g)=>n+g.count,0);
 const published=data.groups.filter(g=>g._id.embed==="completed"&&g._id.publish==="published").reduce((n,g)=>n+g.count,0);
 const skipped=data.groups.filter(g=>g._id.embed==="skipped").reduce((n,g)=>n+g.count,0);
 const remaining=total-published-skipped;
 const slices=[{label:"Published",value:published,tone:"success"},{label:"Skipped",value:skipped,tone:"waiting"},{label:"Outstanding",value:remaining,tone:"alert"}];

 return <div className="overview-grid">
 <Card className="overview-chart"><div className="panel-heading"><h2>Post outcomes <InfoTip text="Current staging posts linked to this job. Published and intentionally skipped posts are resolved. Cleanup can change historical counts."/></h2><Badge className={data.activity.state==="completed"?"api-success":"api-started"}>{jobStatus(data.activity.state)}</Badge></div>
 <div className="outcome-total"><strong>{fmt(total)}</strong><span>retained posts in this job</span></div><div className="outcome-stack" role="img" aria-label={slices.map(s=>s.label+": "+s.value).join(", ")}>{slices.map(s=><div key={s.label} data-bar-tone={s.tone} style={{width:(total?s.value/total*100:0)+"%"}} title={s.label+": "+fmt(s.value)}/>)}</div><div className="outcome-rows">{slices.map(s=><div key={s.label}><i data-bar-tone={s.tone}/><span><strong>{s.label}</strong><small>{s.label==="Published"?"Available in output":s.label==="Skipped"?"Intentionally excluded by the pipeline":"Pending, processing, failed, or not yet published"}</small></span><strong>{fmt(s.value)}</strong><small>{total?(s.value/total*100).toFixed(1):"0.0"}%</small></div>)}</div>
 <div className="resolution-summary"><strong>{total?((published+skipped)/total*100).toFixed(1):"0"}% resolved</strong><span>Published or intentionally skipped</span></div>
 </Card>
 <Card className="overview-checkpoint overview-insights"><div className="job-timeline"><h2>{isFargate?"Overall job execution":"Job execution"} <InfoTip text={isFargate?"Fargate ingest runs fetch posts, generate embeddings, and publish results. This observed span includes gaps between runs and is not billed compute time. The latest recorded run finish does not by itself confirm job completion.":"Wall-clock spans, not billed compute. Fetch and embedding overlap. Overall finish is the latest linked worker finish, not an authoritative completion event."}/></h2><div className="execution-header"><span>Stage</span><span>Start - Finish (UTC+08)</span><span>Elapsed</span></div>{executionRows.map(([name,start,end,seconds])=><div className="execution-row" key={String(name)}><strong>{name}</strong><span>{start?new Date(String(start)).toLocaleTimeString("en-GB",{timeZone:"Asia/Hong_Kong"}):"Unknown"} - {end?new Date(String(end)).toLocaleTimeString("en-GB",{timeZone:"Asia/Hong_Kong"}):"Unfinished"}</span><strong>{duration(seconds as number|null)}</strong></div>)}</div><div className="invocation-chart"><h3>Invocation workload <InfoTip text="Recorded worker runs linked to the selected source job, grouped by stage."/></h3>{(data.source==="lambda"?["lambda-fetch","lambda-embed"]:Array.from(new Set(data.stageBreakdown.map(group=>group._id.stage)))).map(stage=>{const rows=data.stageBreakdown.filter(g=>g._id.stage===stage);const count=rows.reduce((n,g)=>n+g.count,0);return <div className="workload-row" key={stage}><span>{stage==="lambda-fetch"?"Fetch workers":stage==="lambda-embed"?"Embedding workers":stage==="ingest"?"Ingest runs":stage}</span><div className="bar-track"><div style={{width:(data.timing.runCount?count/data.timing.runCount*100:0)+"%"}}/></div><strong>{fmt(count)}</strong></div>;})}</div><p className="execution-note">{isFargate?"Includes gaps between runs. Elapsed time is not Fargate billable runtime.":"Elapsed time measures wall-clock duration."}</p></Card>
 </div>;
}
