"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, Database, Layers, Moon, Sun, RefreshCw, ShieldCheck, Clock3, Lock, Download, Loader2 } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardSelect } from "@/components/dashboard-select";
import { AwsEstimates } from "@/components/aws-estimates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { InfoTip } from "@/components/info-tip";
import Image from "next/image";
import { RunSearch } from "@/components/run-search";
import { LatestActivity } from "@/components/latest-activity";
import { StagingPosts } from "@/components/staging-posts";
import { RunInspector } from "@/components/run-inspector";
import { ActivityStatus } from "@/components/activity-status";
import { CostChart } from "@/components/activity-chart";
import { Overview } from "@/components/overview";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const number = (n:number) => n.toLocaleString("en-US");
const money = (n:number) => "$"+n.toFixed(6);
const time = (value?:string) => value ? new Date(value).toLocaleString("en-GB",{timeZone:"Asia/Kuala_Lumpur",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",year:"numeric"}) : "Not recorded";
type Filters = {job:string;date:string;finished:string;status:string;page:string;postId:string;userId:string;publication:string};
const initial:Filters = {job:"",date:"",finished:"",status:"",page:"1",postId:"",userId:"",publication:""};

export function DashboardView() {
  const [latestData,setLatestData] = useState<DashboardData|null>(null);
  const [data,setData] = useState<DashboardData|null>(null);
  const [draft,setDraft] = useState(initial);
  const [applied,setApplied] = useState(initial);
  const [tab,setTab] = useState("overview");
  const [detail,setDetail] = useState("summary");
  const [pending,setPending] = useState(true);
  const [tabPending,setTabPending] = useState(false);
  const [error,setError] = useState("");
  const [dark,setDark] = useState(true);
  const [runPage,setRunPage] = useState(1);
  const [inspectId,setInspectId] = useState<string|null>(null);
  const [runStage,setRunStage] = useState("");
  const [apiPage,setApiPage] = useState(1);
  const [apiOutcome,setApiOutcome] = useState<string|null>(null);
  const controller = useRef<AbortController|null>(null);
  const tabTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  async function load(filters:Filters) {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/dashboard?"+new URLSearchParams(filters),{signal:request.signal,cache:"no-store"});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load data.");
      if (request.signal.aborted) return;
      setData(result);
      if(result.job?._id===result.lastJob?._id)setLatestData(result);
      else {const latest=await fetch("/api/dashboard?view=live",{signal:request.signal,cache:"no-store"});if(!latest.ok)throw Error("Latest job activity unavailable");const snapshot=await latest.json();if(!request.signal.aborted)setLatestData(snapshot);}
      const normalized = {...filters,job:result.job?._id || "",date:result.date,finished:result.finished};
      setApplied(normalized);setDraft(normalized);setRunPage(1);
    } catch (e) {
      if (!request.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load data.");
    } finally { if (!request.signal.aborted) setPending(false); }
  }
  useEffect(()=>{
    const frame = requestAnimationFrame(()=>{
      let saved = "dark";
      try { saved = localStorage.getItem("monitor-theme") || "dark"; } catch {}
      setDark(saved === "dark");document.documentElement.classList.toggle("dark",saved === "dark");
      void load(initial);
    });
    return ()=>{cancelAnimationFrame(frame);controller.current?.abort();if(tabTimer.current)clearTimeout(tabTimer.current);};
  },[]);
  function theme() {
    const next=!dark;setDark(next);document.documentElement.classList.toggle("dark",next);try { localStorage.setItem("monitor-theme",next?"dark":"light"); } catch {}
  }
  function changeTab(value:string) {
    setTab(value);setTabPending(true);
    if(tabTimer.current)clearTimeout(tabTimer.current);
    tabTimer.current=setTimeout(()=>setTabPending(false),180);
  }
  function exportReport() {
    if(!data)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(data.report,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="usage-report-"+data.date+".json";a.click();URL.revokeObjectURL(url);
  }
  const duration = (seconds:number|null|undefined) => seconds == null ? "Not recorded" : Math.floor(seconds/3600)+"h "+Math.floor(seconds%3600/60)+"m "+Math.floor(seconds%60)+"s";
  const groups=data?.groups || [];
  const retained=groups.reduce((s,g)=>s+g.count,0);
  const published=groups.filter(g=>g._id.embed==="completed"&&g._id.publish==="published").reduce((s,g)=>s+g.count,0);
  const skipped=groups.filter(g=>g._id.embed==="skipped").reduce((s,g)=>s+g.count,0);
  const outstanding=retained-published-skipped;
  const cost=data?.costs.reduce((s,c)=>s+c.estimated_usd,0)||0;
  const unknown=data?.costs.reduce((s,c)=>s+c.unknown_cost_calls,0)||0;
  const overall=data?.overallCosts.reduce((n,c)=>n+c.estimated_usd,0)||0;
  const overallUnknown=data?.overallCosts.reduce((n,c)=>n+c.unknown_cost_calls,0)||0;
  const overallBreakdown=["embedding","extraction"].map(op=>{const c=data?.overallCosts.find(c=>c._id===op);return op+": "+money(c?.estimated_usd||0)+" | "+(c?.count||0)+" recorded API calls";}).join("; ");
  const dailyApi=(data?.report.runs||[]).flatMap(r=>Object.values(r.api).flatMap(outcomes=>Object.entries(outcomes).map(([outcome,v])=>({outcome,...v}))));
  const dailyCalls=dailyApi.reduce((n,a)=>n+a.count,0);
  const dailySuccess=dailyApi.filter(a=>a.outcome==="api_succeeded").reduce((n,a)=>n+a.count,0);
  const completedRuns=data?.report.runs.filter(r=>r.status==="completed").length||0;
  const dateLabel=(value:string)=>new Date(value+"T12:00:00+08:00").toLocaleDateString("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric"});
  const job=data?.job;
  const busy=pending||tabPending;
  const panel = (title:string,children:React.ReactNode) => <Card className={"dash-panel "+(tab==="usage"&&detail==="runs"?"run-panel":tab==="cost"?"cost-panel":"")}><h2>{title}</h2>{children}</Card>;
  const visibleRuns=(data?.report.runs||[]).filter(r=>!runStage||r.stage===runStage);

  return <main className="dash-shell">

    <div className="dash-workspace">
      <header className="dash-header"><div className="flex items-center gap-3"><span className="cloudbreakr-symbol" aria-hidden="true"><Image src="/brand/cloudbreakr-symbol.png" alt="" width={192} height={192} priority/></span><strong className="cloudbreakr-title">Cloudbreakr</strong></div><div className="flex items-center gap-3"><ActivityStatus data={latestData} pending={pending} error={error} selected={tab==="activity"} onSelect={()=>changeTab(tab==="activity"?"overview":"activity")}/><Badge variant="outline"><ShieldCheck data-icon="inline-start"/>Read only</Badge><Button variant="ghost" size="icon" onClick={theme} aria-label={dark?"Switch to light mode":"Switch to dark mode"}>{dark?<Sun/>:<Moon/>}</Button></div></header>
      <section className="dash-heading"><div><div className="title-line"><svg className="instagram-outline" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" role="img" aria-label="Instagram pipeline"><rect x="3" y="3" width="18" height="18" rx="6"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><h1>IG Post Pipeline Automation</h1><div className="region-select"><DashboardSelect label="Pipeline region" value="hk" onChange={()=>{}} options={[{value:"hk",label:"Hong Kong",icon:"/brand/hong-kong.svg"},{value:"my",label:"Malaysia (soon)",disabled:true},{value:"sg",label:"Singapore (soon)",disabled:true}]}/></div></div></div>{tab!=="demo"&&<div className="last-run"><Clock3 size={16}/><div><span>Job started</span><strong>{time(["activity","demo"].includes(tab)?latestData?.job?.created_at:data?.job?.created_at)}</strong></div><Button variant="outline" size="icon" aria-label="Refresh monitoring data" disabled={pending} onClick={()=>load(applied)}><RefreshCw className={pending?"animate-spin":""}/></Button></div>}</section>
      {!["activity","demo"].includes(tab)&&<form className="dash-filters" onSubmit={e=>{e.preventDefault();void load({...draft,page:"1"});}}>
        <label>Source job<DashboardSelect label="Source job" value={draft.job} onChange={job=>setDraft({...draft,job})} options={data?.jobs.length ? data.jobs.map(j=>({value:j._id,label:dateLabel(j.date_from)+(j.date_from!==j.date_until?" - "+dateLabel(j.date_until):"")+" | HK",description:j.benchmark_id+" | Started "+time(j.created_at)})) : [{value:"",label:"No source jobs"}]}/></label>
        <label>Report activity date<DashboardSelect label="Daily report date" value={draft.date} onChange={date=>setDraft({...draft,date})} options={data?.dates.length ? data.dates.map(date=>({value:date,label:dateLabel(date),description:"UTC+08 | "+date})) : [{value:"",label:"No reports"}]}/></label>
        <label>Embedding completion date<DashboardSelect label="Embedding finished date" value={draft.finished} onChange={finished=>setDraft({...draft,finished})} options={[{value:"",label:"All completion dates",description:"Includes unfinished calls"},...(data?.finishedDates||[]).map(date=>({value:date,label:dateLabel(date),description:"UTC+08 | "+date}))]}/></label>
        <Button type="submit" disabled={pending}>{pending?<><Loader2 className="animate-spin"/>Applying</>:"Apply filters"}</Button>
      </form>}
      {error&&<div role="alert" className="dash-error">{error} {data&&"Previous results remain visible."}<Button variant="outline" onClick={()=>load(applied)}>Retry</Button></div>}
      {!["activity","demo"].includes(tab)&&<section className="dash-metrics" aria-busy={pending}>
        {[
          ["Output documents",data?number(data.outputCount):"--","All published output",Database],
          ["MySQL rows fetched",data?number(job?.rows_scanned||0):"--",job?.source_done?"Source fetch finished":"Selected source job",Layers],
          ["Posts outstanding",data?number(outstanding):"--",number(published)+" published | "+number(skipped)+" skipped",Activity],
          ["Overall AI estimate",data?money(overall):"--","All dates | "+overallUnknown+" unknown costs",Clock3],
        ].map(([label,value,note,Icon])=>{void Icon;return <Card key={String(label)} className="dash-metric"><div><span>{String(label)}</span><InfoTip label={String(label)+" information"} text={String(label)==="Overall AI estimate" ? "All stored embedding and extraction estimates in this HK pipeline. "+overallBreakdown+". "+overallUnknown+" unknown-cost calls. Independent of job and date filters. AWS is excluded." : String(label)==="Output documents" ? "All documents in the configured output collection, across jobs. This environment uses benchmark output." : String(label)==="MySQL rows fetched" ? "Rows scanned from Cloudbreakr MySQL for the selected job. Retries can count a row more than once." : "Retained staging posts not yet published or intentionally skipped."}/></div>{pending&&!data?<Skeleton className="h-8 w-28"/>:<strong>{String(value)}</strong>}<small>{String(note)}</small></Card>;})}
      </section>}
      <div className="dashboard-body">
      <nav className="side-nav" aria-label="Dashboard sections">
      {([["overview","Overview"],["staging","Staging post"],["usage","Usage report"],["cost","Embedding cost"],["extraction","Extraction"],["aws","AWS estimation"],["demo","Live preview (Dummy)"]] as const).map(([key,label])=>{
        const locked=key==="extraction"&&!data?.extraction.length;
        return <TooltipProvider key={key}><Tooltip><TooltipTrigger render={<button type="button" className={tab===key?"selected":""} aria-current={tab===key?"page":undefined} aria-disabled={locked} onClick={()=>{if(!locked)changeTab(key);}}/>}>{locked&&<Lock size={14}/>}<span>{label}</span></TooltipTrigger>{locked&&<TooltipContent side="right">No extraction API records are linked to this job. Lambda extraction is currently disabled.</TooltipContent>}</Tooltip></TooltipProvider>;
      })}
      </nav>
      <section key={tab} className="dash-content" aria-busy={busy} aria-live="polite">
      {busy ? <div className="dash-skeleton" role="status"><span className="sr-only">Loading dashboard content</span><Skeleton className="h-8 w-48"/><div className="grid grid-cols-2 gap-4"><Skeleton className="h-24"/><Skeleton className="h-24"/></div><Skeleton className="h-10"/><Skeleton className="h-10"/><Skeleton className="h-10"/></div> : !data ? <div className="dash-empty">Monitoring data is unavailable. Retry the connection above.</div> : <>
        {tab==="overview"&&<Overview data={data}/>}
        {(tab==="activity"||tab==="demo")&&latestData&&<LatestActivity key={tab} data={latestData} demoMode={tab==="demo"} pending={pending} onRefresh={()=>load(applied)}/>}
        {tab==="staging"&&<StagingPosts data={data} filters={applied} onFilter={f=>load({...applied,...f,page:"1"})} onPage={p=>load({...applied,page:String(p)})}/>}
        {tab==="usage"&&panel("Daily usage report",<><div className="flex flex-wrap items-center justify-between gap-3"><p>{data.date||"No report dates"} | {number(data.report.run_count)} runs | Malaysia event date</p><Button variant="outline" onClick={exportReport}><Download/>JSON report</Button></div>{detail==="summary"&&<div className="dash-report-stats"><span>Completed invocation records<strong>{completedRuns.toLocaleString()} | {data.report.run_count.toLocaleString()}</strong></span><span>API success rate<strong>{dailyCalls?(dailySuccess/dailyCalls*100).toFixed(2):"--"}%</strong></span><span>Input tokens | successful call<strong>{dailySuccess?Math.round(dailyApi.filter(a=>a.outcome==="api_succeeded").reduce((n,a)=>n+a.input_tokens,0)/dailySuccess).toLocaleString():"--"}</strong></span><span>Calls with unknown cost<strong>{data.report.totals.unknown_cost_calls} | {dailyCalls.toLocaleString()}</strong></span></div>}<div className="flex gap-2"><Button variant={detail==="summary"?"secondary":"ghost"} onClick={()=>setDetail("summary")}>Event totals</Button><Button variant={detail==="runs"?"secondary":"ghost"} onClick={()=>setDetail("runs")}>Per-run detail</Button></div>{detail==="runs"&&<div className="run-tools"><RunSearch onSelect={setInspectId}/><div className="run-filter"><DashboardSelect label="Invocation stage" value={runStage} onChange={v=>{setRunStage(v);setRunPage(1);}} options={[{value:"",label:"All worker stages"},{value:"lambda-fetch",label:"Fetch workers"},{value:"lambda-embed",label:"Embedding workers"}]}/><span>{visibleRuns.length.toLocaleString()} matching runs</span></div></div>}<div className={"dash-table "+(detail==="summary"?"usage-summary":"run-list")}>{detail==="summary"?<div className="event-bars">{Object.entries(data.report.totals.counts).map(([key,value])=><div key={key}><span>{key.replaceAll("_"," ")}</span><div className="bar-track"><div style={{width:(value/Math.max(1,...Object.values(data.report.totals.counts))*100)+"%"}}/></div><strong>{number(value)}</strong></div>)}</div>:visibleRuns.slice((runPage-1)*6,runPage*6).map(run=><button className="run-row" key={run.run_id} onClick={()=>setInspectId(run.run_id)}><Badge className={run.status==="completed"?"api-success":run.status==="failed"?"api-failure":"api-started"}>{run.status}</Badge><span>{run.stage}<small>{run.run_id}</small></span><span>View details</span></button>)}</div>{detail==="runs"&&<div className="dash-pagination"><Button variant="outline" disabled={runPage===1} onClick={()=>setRunPage(runPage-1)}>Previous</Button><span>Runs page {runPage} | {Math.max(1,Math.ceil(visibleRuns.length/6))}</span><Button variant="outline" disabled={runPage*6>=visibleRuns.length} onClick={()=>setRunPage(runPage+1)}>Next</Button></div>}<div className="info-caption">About this report <InfoTip text="Matches the Python event-date report: includes runs started that day and earlier runs with events that day. Counts are events, not unique posts. Latest run status may change."/></div></>)}
        {tab==="cost"&&panel("Embedding API cost",<><p>{data.finished?"Finished on "+data.finished+" (Malaysia time)":"All embedding API records, including unfinished calls"}</p><div className="dash-report-stats"><span>Known estimate | USD<strong>{money(cost)}</strong></span><span>Unknown-cost calls<strong>{number(unknown)}</strong></span><span>API calls<strong>{number(data.costs.reduce((n,c)=>n+c.count,0))}</strong></span><span>Input tokens<strong>{number(data.costs.reduce((n,c)=>n+c.input_tokens,0))}</strong></span></div><CostChart data={data}/><div className="dash-table cost-table"><Table><TableHeader><TableRow><TableHead>Outcome</TableHead><TableHead>Calls</TableHead><TableHead>Tokens</TableHead><TableHead>Estimate USD</TableHead><TableHead>Unknown</TableHead><TableHead>Rate version | usage</TableHead></TableRow></TableHeader><TableBody>{data.costs.map((c,i)=><TableRow key={i}><TableCell><Button variant="ghost" className="h-auto p-0" onClick={()=>{setApiPage(1);setApiOutcome(c._id.outcome);}} aria-label={"View "+c._id.outcome+" API calls"}><Badge className={c._id.outcome==="api_succeeded"?"api-success":c._id.outcome==="api_failed"?"api-failure":"api-started"}>{c._id.outcome}</Badge></Button></TableCell><TableCell>{number(c.count)}</TableCell><TableCell>{number(c.input_tokens)}</TableCell><TableCell>{money(c.estimated_usd)}</TableCell><TableCell>{c.unknown_cost_calls}</TableCell><TableCell>{c._id.pricing||"unspecified"}<p>{c._id.source}</p></TableCell></TableRow>)}</TableBody></Table>{!data.costs.length&&<p>No matching embedding API records.</p>}</div><div className="info-caption">How this estimate is calculated <InfoTip text="Sum of stored estimated_cost_usd in usage/api_usage, operation=embedding. Finished-date filtering excludes records without finished_at. Null costs remain unknown. AWS infrastructure and extraction costs are excluded. These filters are independent of the selected source job and daily report."/></div></>)}

        {tab==="aws"&&<AwsEstimates key={data.job?.benchmark_id||"no-job"} benchmark={data.job?.benchmark_id}/>}
        {tab==="extraction"&&panel("Extraction cost | selected job",data.extraction.length?<><p>Linked to {job?.benchmark_id}. All extraction records for this job; independent of the daily and embedding-finished filters.</p><div className="dash-table"><Table><TableHeader><TableRow><TableHead>Outcome</TableHead><TableHead>Calls</TableHead><TableHead>Input tokens</TableHead><TableHead>Output tokens</TableHead><TableHead>Known USD</TableHead><TableHead>Unknown</TableHead></TableRow></TableHeader><TableBody>{data.extraction.map((c,i)=><TableRow key={i}><TableCell><Badge className={c._id.outcome==="api_succeeded"?"api-success":"api-failure"}>{c._id.outcome}</Badge></TableCell><TableCell>{c.count}</TableCell><TableCell>{number(c.input_tokens)}</TableCell><TableCell>{number(c.output_tokens)}</TableCell><TableCell>{money(c.estimated_usd)}</TableCell><TableCell>{c.unknown_cost_calls}</TableCell></TableRow>)}</TableBody></Table></div></>:<p>No extraction API records are linked to this job. The Lambda workflow currently disables extraction.</p>)}
      </>}
      </section>
      </div>
      <Dialog open={apiOutcome!==null} onOpenChange={open=>{if(!open)setApiOutcome(null);}}><DialogContent className="api-dialog" onBackdropClick={()=>setApiOutcome(null)}><DialogHeader><DialogTitle>Embedding API | {apiOutcome}</DialogTitle><DialogDescription>Latest 25 calls for this outcome within the applied embedding finished-date filter. Across pricing groups. API success means the provider returned successfully; publication is a separate step.</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">{apiOutcome==="api_failed"?"Failed calls can still incur cost. The backend records exception types, not raw provider messages. A later retry may succeed.":apiOutcome==="started"?"These calls have no recorded final outcome; they may have been interrupted. Do not assume zero cost.":"Token values can be estimated when the provider does not return usage. Stored pricing determines the estimate."}</p><div className="space-y-3">{(data?.apiDetails[apiOutcome||""]||[]).slice(apiPage-1,apiPage).map(call=><Card key={call._id} className="p-4 gap-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>Post {call.post_id}</strong><Badge className={apiOutcome==="api_succeeded"?"api-success":apiOutcome==="api_failed"?"api-failure":"api-started"}>{apiOutcome}</Badge></div><dl className="dash-facts">{[["Model",call.model||"--"],["Recorded",time(call.recorded_at)],["Finished",time(call.finished_at)],["Duration",call.finished_at?duration((Date.parse(call.finished_at)-Date.parse(call.recorded_at))/1000):"Unfinished"],["Tokens (in | out)",(call.input_tokens??"unknown")+" | "+(call.output_tokens??"unknown")],["Estimated USD",call.estimated_cost_usd==null?"Unknown":money(call.estimated_cost_usd)],["Usage source",call.usage_source||"unavailable"],["Error type",call.error_type||"--"],["Run ID",call.run_id]].map(([key,value])=><div key={key}><dt>{key}</dt><dd className="break-all">{value}</dd></div>)}</dl></Card>)}</div><div className="dash-pagination"><Button variant="outline" disabled={apiPage===1} onClick={()=>setApiPage(apiPage-1)}>Previous</Button><span>Call {apiPage} of {data?.apiDetails[apiOutcome||""]?.length||0}</span><Button variant="outline" disabled={apiPage>=(data?.apiDetails[apiOutcome||""]?.length||0)} onClick={()=>setApiPage(apiPage+1)}>Next</Button></div></DialogContent></Dialog>
      <RunInspector key={inspectId||"closed"} id={inspectId} onClose={()=>setInspectId(null)}/>
      <footer className="dash-footer"><span><span className="text-emerald-500">●</span> MongoDB reporting</span><span>{data?"Updated "+time(data.refreshedAt)+" | ":""}Asia/Kuala_Lumpur | USD</span></footer>
    </div>
  </main>;
}
