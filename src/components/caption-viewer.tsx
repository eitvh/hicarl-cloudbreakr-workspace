"use client";
import { useState } from "react";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PopupTransition } from "@/components/popup-transition";
export function CaptionContent({caption}:{caption:string}){
 const [copied,setCopied]=useState(false),[error,setError]=useState("");
 return <div className="caption-content"><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(caption);setCopied(true);}catch{setError("Select the text below to copy it.");}}}>{copied?"Caption copied":"Copy full caption"}</Button>{error&&<p role="status">{error}</p>}<div className="continuous-caption" tabIndex={0} aria-label="Full caption">{caption||"No caption recorded"}</div></div>;
}
export function CaptionViewer({caption,postId}:{caption:string;postId:string}){
 const [open,setOpen]=useState(false);
 return <><Button variant="ghost" size="sm" onClick={()=>setOpen(true)}>Full caption</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="caption-dialog" onBackdropClick={()=>setOpen(false)}><DialogHeader><DialogTitle>Full caption</DialogTitle><DialogDescription>POST ID: {postId}</DialogDescription></DialogHeader><PopupTransition><CaptionContent caption={caption}/></PopupTransition></DialogContent></Dialog></>;
}
