"use client";
import type { DashboardData } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
export function ActivityStatus({data,pending,error,onSelect,selected}:{data:DashboardData|null;pending:boolean;error:string;onSelect:()=>void;selected:boolean}){
 const state=error?"unavailable":pending?"checking":data?.activity.state||"idle";
 if(pending||error||!data||!["fetching","embedding","attention"].includes(state))return null;
 return <Button variant={selected?"secondary":"ghost"} className="activity-indicator active" onClick={onSelect} aria-pressed={selected} title="Recent activity recorded for an unfinished job. Inferred from MongoDB at refresh, not a worker heartbeat."><i/>Live automation</Button>;
}
