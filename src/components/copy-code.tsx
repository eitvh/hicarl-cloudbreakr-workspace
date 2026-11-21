"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CopyCode({value,label}:{value:string;label?:string}){
 const [copied,setCopied]=useState(false),[error,setError]=useState(false);
 return <span className="copy-code">{label&&<span className="code-label">{label}:</span>}<code title={value}>{value}</code><Button size="icon-sm" variant="ghost" aria-label={"Copy "+value} onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setError(true);}}}>{copied?<Check/>:<Copy/>}</Button>{error&&<small>Select the code to copy</small>}</span>;
}
