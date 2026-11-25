"use client";
import Image from "next/image";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
export function DashboardSelect({value,onChange,options,label}:{value:string;onChange:(value:string)=>void;options:{value:string;label:string;description?:string;icon?:string;disabled?:boolean}[];label:string}){
 const items=options.map(o=>({...o,value:o.value||"__all__"}));
 return <Select value={value||"__all__"} items={items} onValueChange={v=>onChange(v==="__all__"?"":String(v))}><SelectTrigger className="w-full" aria-label={label}><SelectValue><span key={value} className="select-selection-motion country-label">{options.find(o=>o.value===value)?.icon&&<Image src={options.find(o=>o.value===value)!.icon!} alt="" width={20} height={14}/>}<span>{options.find(o=>o.value===value)?.label||value}</span></span></SelectValue></SelectTrigger><SelectContent alignItemWithTrigger={false}>{items.map(o=><SelectItem key={o.value} value={o.value} disabled={o.disabled}><span className="select-option"><span className="country-label">{o.icon&&<Image src={o.icon} alt="" width={20} height={14}/>} {o.label}</span>{o.description&&<small>{o.description}</small>}</span></SelectItem>)}</SelectContent></Select>;
}
