"use client";
import { ChevronRight } from "lucide-react";
import { stageLabel, sourceLabel, type PipelineSource } from "@/lib/pipeline-source";
import { useRef,useEffect,useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardSelect } from "@/components/dashboard-select";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
const runTime = new Intl.DateTimeFormat("en-GB", {
 day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", timeZone:"Asia/Kuala_Lumpur",
});

export function RunSearch({source,onSelect}:{source:PipelineSource;onSelect:(id:string)=>void}){
 const [kind,setKind]=useState("run"),[q,setQ]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [rows,setRows]=useState<{_id:string;stage:string;status:string;started_at?:string}[]>([]),[page,setPage]=useState(1);
 const [submitted,setSubmitted]=useState({kind:"",id:""});
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function search(){
  controller.current?.abort();setRows([]);setMessage("");setPage(1);
  if(kind==="run"){onSelect(q.trim().toLowerCase());return;}
  setSubmitted({kind,id:q.trim()});
  const request=new AbortController();controller.current=request;setBusy(true);
  try{const r=await fetch("/api/investigate?"+new URLSearchParams({source,kind,q:q.trim()}),{signal:request.signal,cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error);setRows(d.runs);setMessage(d.note+(d.limited?" Limited to 100 posts/runs. Search a specific post to narrow results.":"")+(d.runs.length?"":" No matching runs found."));}catch(e){if(!request.signal.aborted)setMessage(e instanceof Error?e.message:"Search failed.");}finally{if(!request.signal.aborted)setBusy(false);}
 }
 return <div className="investigation-search"><form className="run-search" onSubmit={e=>{e.preventDefault();void search();}}><DashboardSelect label="Search identifier type" value={kind} onChange={v=>{setKind(v);setRows([]);setMessage("");}} options={[{value:"run",label:"Run UUID"},{value:"post",label:"Post ID"},{value:"user",label:"User ID"}]}/><Input aria-label="Investigation identifier" placeholder={kind==="run"?"Paste full run UUID":"Enter exact "+kind+" ID"} value={q} onChange={e=>setQ(e.target.value)}/><Button disabled={busy||!q.trim()} type="submit">{busy?"Searching":"Investigate"}</Button></form>{busy?<Skeleton className="h-12"/>:message&&<Dialog open={!!message} onOpenChange={open=>{if(!open)setMessage("");}}><DialogContent className="search-dialog" onBackdropClick={()=>setMessage("")}><DialogHeader className="match-header">
   <DialogTitle>Matching runs</DialogTitle>
   <DialogDescription className="match-query">
     <span>{sourceLabel(source)}</span><span>{submitted.kind==="user"?"User ID":"Post ID"} <code>{submitted.id}</code></span>
   </DialogDescription>
  </DialogHeader>
  <div className="match-results">
   {rows.length>0 && <p className="match-count">{rows.length} {rows.length===1?"run":"runs"} found</p>}
   {rows.slice((page-1)*2,page*2).map(run=>{
     const started=run.started_at ? new Date(run.started_at) : null;
     return <button type="button" className="match-row" key={run._id} onClick={()=>{setMessage("");onSelect(run._id);}}>
       <span className="match-summary">
         <strong>{stageLabel(run.stage)}</strong>
         <span className="match-status" data-status={run.status}>{run.status || "Unknown status"}</span>
       </span>
       {started && Number.isFinite(started.getTime()) && <span className="match-start">Started <time dateTime={run.started_at}>{runTime.format(started)} MYT</time></span>}
       <span className="match-id">Run ID <code>{run._id}</code></span>
       <ChevronRight size={18} aria-hidden="true"/>
     </button>;
   })}
   <p className="match-note">{message}</p>{rows.length>2&&<div className="dash-pagination"><Button size="sm" variant="ghost" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><span>{page} / {Math.ceil(rows.length/2)}</span><Button size="sm" variant="ghost" disabled={page*2>=rows.length} onClick={()=>setPage(page+1)}>Next</Button></div>}</div></DialogContent></Dialog>}</div>;
}
