"use client";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
export function InfoTip({text,label="More information"}:{text:string;label?:string}) {
 return <TooltipProvider><Tooltip><TooltipTrigger aria-label={label} className="info-tip"><Info size={14}/></TooltipTrigger><TooltipContent className="max-w-sm text-sm leading-relaxed">{text}</TooltipContent></Tooltip></TooltipProvider>;
}
