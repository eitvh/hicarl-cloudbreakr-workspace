"use client";
import { useState } from "react";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function CaptionViewer({caption,postId}:{caption:string;postId:string}){
 const [open,setOpen]=useState(false),[page,setPage]=useState(1),[copied,setCopied]=useState(false),[error,setError]=useState("");const chars=Array.from(caption),pages=Math.max(1,Math.ceil(chars.length/450));
 return <><Button variant="ghost" size="sm" onClick={()=>{setOpen(true);setPage(1);}}>Full caption</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="caption-dialog" onBackdropClick={()=>setOpen(false)}><DialogHeader><DialogTitle>Full caption</DialogTitle><DialogDescription>POST ID: {postId}</DialogDescription></DialogHeader><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(caption);setCopied(true);}catch{setError("Copy unavailable. Select the caption text to copy.");}}}>{copied?"Caption copied":"Copy full caption"}</Button>{error&&<p role="status">{error}</p>}<p className="full-caption">{chars.slice((page-1)*450,page*450).join('')||"No caption recorded"}</p><div className="dash-pagination"><Button variant="outline" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><span>Caption page {page} of {pages}</span><Button variant="outline" disabled={page===pages} onClick={()=>setPage(page+1)}>Next</Button></div></DialogContent></Dialog></>;
}
