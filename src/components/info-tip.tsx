"use client";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
export function InfoTip({text,label="More information"}:{text:string;label?:string}) {
 // Split explanatory sentences, preserving decimal costs and field names.
 const points=text.split(/(?<=[.!?])\s+(?=[A-Z0-9])|;\s+/).map(point=>point.trim()).filter(Boolean);
 return <TooltipProvider><Tooltip><TooltipTrigger aria-label={label} className="info-tip"><Info size={14}/></TooltipTrigger><TooltipContent className="max-w-sm text-sm leading-relaxed">{points.length>1?<ul className="info-tip-list">{points.map((point,index)=><li key={index}>{point}</li>)}</ul>:text}</TooltipContent></Tooltip></TooltipProvider>;
}
