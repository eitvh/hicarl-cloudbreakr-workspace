"use client";
import Image from "next/image";
import { sourceLabel, stageLabel, type PipelineSource } from "@/lib/pipeline-source";
import { useEffect, useState } from "react";
import type { RunInspection } from "@/lib/dashboard";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CaptionViewer } from "@/components/caption-viewer";
import { CopyCode } from "@/components/copy-code";
const time=(s?:string)=>s?new Date(s).toLocaleString("en-GB",{timeZone:"Asia/Hong_Kong"}):"Not recorded";
function RunDetailsSkeleton() {
 return <div className="run-loading" role="status" aria-label="Loading run details">
   <Skeleton className="h-3 w-2/3"/>
   {[0,1,2].map(row=><div className="run-loading-row" key={row} aria-hidden="true">
     <Skeleton className="h-4 w-1/3"/>
     <Skeleton className="h-3 w-5/6"/>
     <Skeleton className="h-3 w-1/2"/>
   </div>)}
 </div>;
}

export function RunInspector({source,id,onClose}:{source:PipelineSource;id:string|null;onClose:()=>void}){
 const [result,setResult]=useState<RunInspection|null>(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(true),[page,setPage]=useState(1),[tab,setTab]=useState("summary"),[apiPage,setApiPage]=useState(1);
 useEffect(()=>{
  if(!id)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   setBusy(true);setError("");
   fetch("/api/runs/"+encodeURIComponent(id)+"?source="+source+"&page="+page,{signal:controller.signal,cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;}).then(d=>setResult(d)).catch(e=>{if(!controller.signal.aborted){setResult(null);setError(e.message);}}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  },0);
  return()=>{clearTimeout(timer);controller.abort();};
 },[id,page,source]);
 return <Dialog open={!!id} onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="run-dialog" onBackdropClick={onClose}><DialogHeader className="investigation-header">
   <DialogTitle>Run investigation</DialogTitle>
   <DialogDescription className="investigation-context">
     <span className="investigation-region"><Image src="/brand/hong-kong.svg" width={20} height={14} alt=""/>Hong Kong</span>
     <span>{sourceLabel(source)}</span>
     {result && <span>{stageLabel(result.run.stage)}</span>}
   </DialogDescription>
 </DialogHeader>
 <div className="investigation-identity">
   <CopyCode label="Run ID" value={id||""}/>
   {result && <div className="run-badges"><Badge className={result.run.status==="completed"?"api-success":result.run.status==="failed"?"api-failure":"api-started"}>{result.run.status}</Badge>
     <span>{result.total.toLocaleString()} linked {result.total===1?"post":"posts"}</span></div>}
 </div><div className="inspector-tabs" role="tablist" aria-label="Run details">{["summary","posts","api"].map(t=><Button key={t} role="tab" aria-selected={tab===t} variant={tab===t?"secondary":"ghost"} onClick={()=>setTab(t)}>{t==="api"?"API results":t==="posts"?"Linked posts":"Summary"}</Button>)}</div><div className="inspector-body" key={tab}>{busy?<RunDetailsSkeleton/>:error?<p role="alert">{error}</p>:result&&<>
 {tab==="summary"&&<><p className="inspector-note">Timing and event counts cover this run across all report dates. Times are in Hong Kong time (UTC+8).</p><div className="run-timestamps"><div><small>Started</small><strong>{time(result.run.started_at)}</strong></div><div><small>Finished</small><strong>{time(result.run.finished_at)}</strong></div></div><dl className="run-identifiers"><dt>Benchmark</dt><dd>{result.run.benchmark_id||"Not recorded"}</dd><dt>AWS request ID</dt><dd><CopyCode value={result.run.aws_request_id||"Not recorded"}/></dd><dt>Source job</dt><dd><CopyCode value={result.run.job_id||"Not recorded"}/></dd></dl><div className="run-counts">{result.counts.map(c=><span key={c._id}><small>{c._id==="synced"?"Posts synced to staging":c._id.replaceAll("_"," ")}</small><strong>{c.count.toLocaleString()}</strong><small>Recorded events in this run</small></span>)}</div>{result.run.aws_request_id&&<p className="inspector-note">Use the AWS request ID to find this invocation in CloudWatch logs.</p>}</>}
 {tab==="posts"&&<><p className="inspector-note">Each post below has a recorded event in this run. The caption and publication status come from its latest staging record.</p><div className="linked-posts">{result.posts.map(p=><article key={p.post_id}><div className="linked-post-title"><CopyCode label="POST ID" value={p.post_id}/><CaptionViewer caption={p.current?.caption||""} postId={p.post_id}/></div><p className="post-caption" title={p.current?.caption}>{p.current?.caption||(p.current?"No caption recorded":"Staging record unavailable")}</p><div className="post-state"><span className="field-label">Current embedding</span><Badge className={p.current?.jobs?.embed?.status==="completed"?"api-success":p.current?.jobs?.embed?.status==="failed"?"api-failure":"api-started"}>{p.current?.jobs?.embed?.status||"Unknown"}</Badge><span>Current publication <strong>{p.current?.publish_status||"Unknown"}</strong></span></div><div className="recorded-events"><span>Events in this run</span>{[...p.metrics,...p.outcomes].filter(Boolean).map(e=><span key={e} className="event-chip">{e.replaceAll("_"," ")}</span>)}</div></article>)}{!result.posts.length&&<p>No linked post events were recorded.</p>}</div>{result.total>3&&<div className="dash-pagination"><Button variant="outline" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><span>{page} of {Math.max(1,Math.ceil(result.total/3))}</span><Button variant="outline" disabled={page*3>=result.total} onClick={()=>setPage(page+1)}>Next</Button></div>}</>}
 {tab==="api"&&<>
   <p className="inspector-note">Calls are grouped by operation, model, outcome and error. Token counts and estimated costs are totals for each group across the full run.</p>
   <div className="linked-posts">{result.api.slice((apiPage-1)*3,apiPage*3).map((a,i)=><article key={i}>
     <div className="panel-heading"><strong className="operation-name">{a._id.operation}</strong>
       <Badge className={a._id.outcome==="api_succeeded"?"api-success":a._id.outcome==="api_failed"?"api-failure":"api-started"}>
         {a._id.outcome==="api_succeeded"?"Succeeded":a._id.outcome==="api_failed"?"Failed":a._id.outcome}
       </Badge></div>
     <p>Model <strong>{a._id.model||"Not recorded"}</strong></p>
     <dl className="api-group-metrics">
       <div><dt>Calls</dt><dd>{a.calls.toLocaleString()}</dd></div>
       <div><dt>Input tokens</dt><dd>{a.input.toLocaleString()}</dd></div>
       <div><dt>Output tokens</dt><dd>{a.output.toLocaleString()}</dd></div>
       <div><dt>Known estimate (USD)</dt><dd>${a.cost.toFixed(6)}</dd></div>
     </dl>
     <p className="inspector-note">{a.unknown ? `${a.unknown} ${a.unknown===1?"call has":"calls have"} no cost estimate.` : "Every call in this group has a cost estimate."}</p>
     {a._id.error&&<p>Error: {a._id.error}</p>}
   </article>)}{!result.api.length&&<p>No API calls were recorded for this run.</p>}</div>
   {result.api.length>3&&<div className="dash-pagination"><Button disabled={apiPage===1} variant="outline" onClick={()=>setApiPage(apiPage-1)}>Previous</Button><span>{apiPage} of {Math.ceil(result.api.length/3)}</span><Button disabled={apiPage*3>=result.api.length} variant="outline" onClick={()=>setApiPage(apiPage+1)}>Next</Button></div>}
 </>}
 </>}</div></DialogContent></Dialog>;
}
