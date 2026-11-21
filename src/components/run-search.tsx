"use client";
import { useRef,useEffect,useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardSelect } from "@/components/dashboard-select";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
export function RunSearch({onSelect}:{onSelect:(id:string)=>void}){
 const [kind,setKind]=useState("run"),[q,setQ]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [rows,setRows]=useState<{_id:string;stage:string;status:string}[]>([]),[page,setPage]=useState(1);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function search(){
  controller.current?.abort();setRows([]);setMessage("");setPage(1);
  if(kind==="run"){onSelect(q.trim().toLowerCase());return;}
  const request=new AbortController();controller.current=request;setBusy(true);
  try{const r=await fetch("/api/investigate?"+new URLSearchParams({kind,q:q.trim()}),{signal:request.signal,cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error);setRows(d.runs);setMessage(d.note+(d.limited?" Limited to 100 posts/runs. Search a specific post to narrow results.":"")+(d.runs.length?"":" No matching runs found."));}catch(e){if(!request.signal.aborted)setMessage(e instanceof Error?e.message:"Search failed.");}finally{if(!request.signal.aborted)setBusy(false);}
 }
 return <div className="investigation-search"><form className="run-search" onSubmit={e=>{e.preventDefault();void search();}}><DashboardSelect label="Search identifier type" value={kind} onChange={v=>{setKind(v);setRows([]);setMessage("");}} options={[{value:"run",label:"Run UUID"},{value:"post",label:"Post ID"},{value:"user",label:"User ID"}]}/><Input aria-label="Investigation identifier" placeholder={kind==="run"?"Paste full run UUID":"Enter exact "+kind+" ID"} value={q} onChange={e=>setQ(e.target.value)}/><Button disabled={busy||!q.trim()} type="submit">{busy?"Searching":"Investigate"}</Button></form>{busy?<Skeleton className="h-12"/>:message&&<Dialog open={!!message} onOpenChange={open=>{if(!open)setMessage("");}}><DialogContent className="search-dialog" onBackdropClick={()=>setMessage("")}><DialogHeader><DialogTitle>Matching runs</DialogTitle><DialogDescription>Exact {kind} ID: {q}</DialogDescription></DialogHeader><div className="search-results"><p>{message}</p>{rows.slice((page-1)*2,page*2).map(r=><button key={r._id} onClick={()=>{setMessage("");onSelect(r._id);}}><code>{r._id}</code><span>{r.stage} | {r.status}</span></button>)}{rows.length>2&&<div className="dash-pagination"><Button size="sm" variant="ghost" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><span>{page} / {Math.ceil(rows.length/2)}</span><Button size="sm" variant="ghost" disabled={page*2>=rows.length} onClick={()=>setPage(page+1)}>Next</Button></div>}</div></DialogContent></Dialog>}</div>;
}
