"use client";
import type { DashboardData } from "@/lib/dashboard";
import { InfoTip } from "@/components/info-tip";
export function ActivityChart({data}:{data:DashboardData}){
 const points=data.timeline;
 const max=Math.max(1,...points.map(p=>p.calls));
 const width=600,height=100;
 return <div className="activity-chart"><div className="panel-heading"><h3>API activity / minute <InfoTip text="API calls recorded for this selected source job, grouped by Hong Kong time. Retries are included. Empty time buckets are omitted; each bar is an active minute."/></h3><small>{points.reduce((n,p)=>n+p.calls,0).toLocaleString()} calls</small></div>{points.length?<><svg viewBox={"0 0 "+width+" "+height} preserveAspectRatio="none" role="img" aria-label="API calls per active minute">{points.map((p,i)=><rect key={p._id} x={i*width/points.length} y={height-p.calls/max*90} width={Math.max(.5,width/points.length-1)} height={Math.max(1,p.calls/max*90)} rx="1" fill={p.failed?"#ef879c":"#b493ff"}><title>{p._id}: {p.calls} calls, {p.failed} failed, {p.tokens} tokens</title></rect>)}</svg><div className="chart-axis"><span>{points[0]._id.slice(11,16)} HKT</span><span>{points.at(-1)?._id.slice(11,16)} HKT</span></div></>:<p>No API activity recorded for this job.</p>}</div>;
}
export function CostChart({data}:{data:DashboardData}){
 const outcomes=["api_succeeded","api_failed","started"].map(outcome=>({outcome,count:data.costs.filter(c=>c._id.outcome===outcome).reduce((n,c)=>n+c.count,0)}));
 const total=outcomes.reduce((n,o)=>n+o.count,0);
 return <div className="cost-chart"><h3>API outcome mix <InfoTip text="Filtered embedding API calls, not unique posts. A post can have a failed attempt followed by success."/></h3><div className="outcome-stack">{outcomes.map(o=><div key={o.outcome} data-bar-tone={o.outcome} style={{width:(total?o.count/total*100:0)+"%"}} title={o.outcome+": "+o.count}/>)}</div><div className="cost-chart-labels">{outcomes.map(o=><span key={o.outcome}><i className="cost-outcome-dot" data-bar-tone={o.outcome}/>{o.outcome.replace("api_","")} <strong>{o.count.toLocaleString()}</strong> <small>{total?(o.count/total*100).toFixed(2):"0"}%</small></span>)}</div></div>;
}
