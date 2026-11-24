"use client";
import {selectSnapshotDate} from "@/lib/report-selection";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun, ShieldCheck, Clock3, Lock, Download, Loader2 } from "lucide-react";
import { pipelineSource, type PipelineSource } from "@/lib/pipeline-source";
import type { DashboardData } from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { DashboardLoading } from "@/components/dashboard-loading";
import { DashboardSelect } from "@/components/dashboard-select";
import { AwsEstimates } from "@/components/aws-estimates";
import { FargateEstimates } from "@/components/fargate-estimates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { InfoTip } from "@/components/info-tip";
import Image from "next/image";
import { RunSearch } from "@/components/run-search";
import { jobStatus } from "@/lib/pipeline-source";
import { StagingBrowser } from "@/components/staging-browser";
import { RunInspector } from "@/components/run-inspector";
import { ActivityStatus } from "@/components/activity-status";
import { CostChart } from "@/components/activity-chart";
import { AccountMenu } from "@/components/account-menu";
import { JobComparison } from "@/components/job-comparison";
import { DateOverview } from "@/components/date-overview";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const number = (n:number) => n.toLocaleString("en-US");
const money = (n:number) => "$"+n.toFixed(6);
const time = (value?:string) => value ? new Date(value).toLocaleString("en-GB",{timeZone:"Asia/Kuala_Lumpur",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",year:"numeric"}) : "Not recorded";
type Filters = {view:string;job:string;date:string;finished:string;status:string;page:string;postId:string;userId:string;publication:string};
const initial:Filters = {view:"overview",job:"",date:"all",finished:"",status:"",page:"1",postId:"",userId:"",publication:""};

const completedSnapshots=new Map<string,DashboardData>();
const rememberedFilters=new Map<PipelineSource,Filters>();
const snapshotKey=(source:PipelineSource,filters:Filters)=>source+':'+JSON.stringify(filters);
export function DashboardView({username}:{username:string}) {
  const [source, setSource] = useState<PipelineSource>("lambda");
  return <PipelineDashboard key={source} source={source} onSourceChange={setSource} username={username}/>;
}

function PipelineDashboard({ source, onSourceChange,username }: { username:string;source: PipelineSource; onSourceChange: (source: PipelineSource) => void }) {
  const [apiDetailTab,setApiDetailTab]=useState("call");
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
  const [costPage,setCostPage] = useState(1);
  const [runPage,setRunPage] = useState(1);
  const [inspectId,setInspectId] = useState<string|null>(null);
  const [runStage,setRunStage] = useState("");
  const [apiPage,setApiPage] = useState(1);
  const [apiOutcome,setApiOutcome] = useState<string|null>(null);
  const [apiCalls,setApiCalls]=useState<DashboardData['apiDetails'][string]>([]);
  const [apiLoading,setApiLoading]=useState(false),[apiError,setApiError]=useState('');
  useEffect(()=>{
    if(!apiOutcome||!data?.job)return;
    const request=new AbortController();queueMicrotask(()=>{setApiLoading(true);setApiError('');setApiCalls([]);});
    fetch('/api/api-calls?'+new URLSearchParams({source,job:data.job._id,date:data.date,outcome:apiOutcome}),{signal:request.signal,cache:'no-store'}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error||'Unable to load API calls');return value.calls;}).then(calls=>{if(!request.signal.aborted)setApiCalls(calls);}).catch(e=>{if(!request.signal.aborted)setApiError(e.message);}).finally(()=>{if(!request.signal.aborted)setApiLoading(false);});
    return()=>request.abort();
  },[apiOutcome,source,data?.job,data?.date]);
  const currentData=useRef<DashboardData|null>(null);
  const controller = useRef<AbortController|null>(null);
  const tabTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const currentFilters = useRef(initial);
  const load = useCallback(async (filters:Filters, background = false, fresh = false) => {
    if (background && controller.current) return;
    filters={...filters,view:"overview",page:"1",postId:"",userId:"",status:"",publication:""};
    if(fresh)for(const key of completedSnapshots.keys())if(key.startsWith(source+':'))completedSnapshots.delete(key);
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    if (!background) { setPending(true); setError(""); }
    try {
      const previous=currentData.current;
      const sameJob=previous&&previous.source===source&&previous.job?._id===filters.job;
      const cached=(sameJob?selectSnapshotDate(previous,filters.date):null)||completedSnapshots.get(snapshotKey(source,filters));
      const reusable=!fresh&&cached&&Date.now()-Date.parse(cached.cache?.savedAt||cached.refreshedAt)<(cached.cache?.ttlSeconds||60)*1000;
      const response = reusable?null:await fetch("/api/dashboard?"+new URLSearchParams({...filters,source,...(fresh?{refresh:"1"}:{})}),{signal:request.signal,cache:"no-store"});
      const result = reusable?cached:await response!.json();
      if (response && !response.ok) throw new Error(result.error || "Unable to load data.");
      if (request.signal.aborted) return;
      currentData.current=result;setData(result);
      if(result.job?._id===result.lastJob?._id)setLatestData(result);
      if((reusable&&background)||result.job?._id!==result.lastJob?._id){void fetch("/api/dashboard?view=live&source="+source,{signal:request.signal,cache:"no-store"}).then(async r=>{if(r.ok){const snapshot=await r.json();if(!request.signal.aborted)setLatestData(snapshot);}}).catch(()=>{});}
      const normalized = {...filters,page:String(result.page),job:result.job?._id || "",date:result.date,finished:result.finished};
      rememberedFilters.set(source,normalized);
      if(result.activity.state==='completed'&&result.job){completedSnapshots.set(snapshotKey(source,normalized),result);if(filters.job)completedSnapshots.set(snapshotKey(source,filters),result);}
      while(completedSnapshots.size>12)completedSnapshots.delete(completedSnapshots.keys().next().value!);
      if (request.signal.aborted) return;
      setError("");
      if (!background) { currentFilters.current=normalized; setApplied(normalized);setDraft(normalized);setRunPage(1);setCostPage(1); }
    } catch (e) {
      if (!request.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load data.");
    } finally { if (!request.signal.aborted) { controller.current=null; setPending(false); } }
  }, [source]);
  useEffect(()=>{
    const frame = requestAnimationFrame(()=>{
      let saved = "dark";
      try { saved = localStorage.getItem("monitor-theme") || "dark"; } catch {}
      setDark(saved === "dark");document.documentElement.classList.toggle("dark",saved === "dark");
      void load(rememberedFilters.get(source)||initial);
    });
    const timer = setInterval(()=>void load(currentFilters.current,true),120_000);
    return ()=>{clearInterval(timer);cancelAnimationFrame(frame);controller.current?.abort();if(tabTimer.current)clearTimeout(tabTimer.current);};
  },[load,source]);
  function theme(event:React.MouseEvent<HTMLButtonElement>) {
    const root=document.documentElement;
    if(root.classList.contains('theme-reveal')||root.classList.contains('theme-fade'))return;
    const next=!dark;
    const apply=()=>{flushSync(()=>setDark(next));root.classList.toggle('dark',next);try{localStorage.setItem('monitor-theme',next?'dark':'light');}catch{}};
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){apply();return;}
    if(!document.startViewTransition){root.classList.add('theme-fade');apply();window.setTimeout(()=>root.classList.remove('theme-fade'),450);return;}
    const rect=event.currentTarget.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    root.style.setProperty('--theme-x',x+'px');root.style.setProperty('--theme-y',y+'px');root.style.setProperty('--theme-radius',Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+'px');root.classList.add('theme-reveal');
    const transition=document.startViewTransition(apply);void transition.finished.catch(()=>{}).finally(()=>root.classList.remove('theme-reveal'));
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
  const cost=data?.costs.reduce((s,c)=>s+c.estimated_usd,0)||0;
  const unknown=data?.costs.reduce((s,c)=>s+c.unknown_cost_calls,0)||0;
  const dailyApi=(data?.report.runs||[]).flatMap(r=>Object.values(r.api).flatMap(outcomes=>Object.entries(outcomes).map(([outcome,v])=>({outcome,...v}))));
  const dailyCalls=dailyApi.reduce((n,a)=>n+a.count,0);
  const dailySuccess=dailyApi.filter(a=>a.outcome==="api_succeeded").reduce((n,a)=>n+a.count,0);
  const completedRuns=data?.report.runs.filter(r=>r.status==="completed").length||0;
  const dateLabel=(value:string)=>value==="all"?"All activity dates":new Date(value+"T12:00:00+08:00").toLocaleDateString("en-GB",{timeZone:"Asia/Hong_Kong",day:"2-digit",month:"short",year:"numeric"});
  const job=data?.job;
  const busy=pending||tabPending;
  const panel = (title:string,children:React.ReactNode) => <Card className={"dash-panel "+(tab==="usage"&&detail==="runs"?"run-panel":tab==="cost"?"cost-panel":"")}><h2>{title}</h2>{children}</Card>;
  const visibleRuns=(data?.report.runs||[]).filter(r=>!runStage||r.stage===runStage);

  const costPages=Math.ceil((data?.costs.length||0)/5);
  const shownCostPage=Math.min(costPage,Math.max(1,costPages));
  const runPages=Math.ceil(visibleRuns.length/6);
  const shownRunPage=Math.min(runPage,Math.max(1,runPages));

  if (pending && !data && !error) return <DashboardLoading/>;

  return <main className="dash-shell" data-job-state={error ? undefined : data?.activity.state}>

    <div className="dash-workspace">
      <header className="pipeline-header">
      <div className="dash-header"><div className="flex items-center gap-3"><span className="cloudbreakr-symbol" aria-hidden="true"><Image src="/brand/cloudbreakr-symbol.png" alt="" width={192} height={192} priority/></span><strong className="cloudbreakr-title">Cloudbreakr</strong></div><div className="flex items-center gap-3"><ActivityStatus source={source} data={latestData} error={error}/><AccountMenu username={username}/><Button variant="ghost" size="icon" onClick={theme} aria-label={dark?"Switch to light mode":"Switch to dark mode"}>{dark?<Sun/>:<Moon/>}</Button></div></div>
      <section className="dash-heading"><div><div className="title-line"><div className="pipeline-identity"><Image className="instagram-outline" src="/brand/instagram-outline.svg" alt="Instagram" width={36} height={36}/><h1>{source==="manual"?"IG Post Pipeline Manual":"IG Post Pipeline Automation"}</h1></div><div className="pipeline-controls" hidden={tab==="comparison"}><div className="pipeline-select"><DashboardSelect label="Pipeline source" value={source} onChange={value=>{const selected=pipelineSource(value);if(selected)onSourceChange(selected);}} options={[{value:"lambda",label:"Lambda"},{value:"fargate",label:"Fargate"},{value:"manual",label:"Manual"}]}/></div><div className="region-select"><DashboardSelect label="Pipeline region" value="hk" onChange={()=>{}} options={[{value:"hk",label:"Hong Kong",icon:"/brand/hong-kong.svg"},{value:"my",label:"Malaysia (soon)",icon:"/brand/malaysia.svg",disabled:true},{value:"sg",label:"Singapore (soon)",icon:"/brand/singapore.svg",disabled:true}]}/></div></div></div></div><div className="last-run" data-state={error ? undefined : data?.activity.state}><Clock3 size={16}/><div><span>Job started</span><strong>{time(job?.created_at)}</strong></div><Badge variant="outline">{error?"Status unavailable":data?jobStatus(data.activity.state):"Checking status"}</Badge></div></section>
      </header>
      {!["activity","demo","comparison"].includes(tab)&&<form className="dash-filters" onSubmit={e=>{e.preventDefault();void load({...draft,page:"1"});}}>
        <label>Source job<DashboardSelect label="Source job" value={draft.job} onChange={job=>setDraft({...draft,job})} options={data?.jobs.length ? data.jobs.map(j=>({value:j._id,label:dateLabel(j.date_from)+(j.date_from!==j.date_until?" - "+dateLabel(j.date_until):""),description:j.benchmark_id+" | Started "+time(j.created_at)})) : [{value:"",label:"No source jobs"}]}/></label>
        <label>Report activity date<DashboardSelect label="Daily report date" value={draft.date} onChange={date=>setDraft({...draft,date})} options={data?.dates.length ? [{value:"all",label:"All activity dates"},...data.dates.map(date=>({value:date,label:dateLabel(date),description:"UTC+08 | "+date}))] : [{value:"all",label:"All activity dates"}]}/></label>
        <Button type="submit" disabled={pending}>{pending?<><Loader2 className="animate-spin"/>Applying</>:"Apply filters"}</Button>
      </form>}
      {error&&<div role="alert" className="dash-error">{error} {data&&"Previous results remain visible."}<Button variant="outline" onClick={()=>load(applied)}>Retry</Button></div>}
      {!["activity","demo","comparison"].includes(tab)&&<section className="dash-metrics" aria-busy={pending}>
        {[['Published events',number(data?.report.totals.counts.published||0)],['Fetched events',number(data?.report.totals.counts.synced||0)],['Failed events',number((data?.report.totals.counts.embedding_failed||0)+(data?.report.totals.counts.extraction_failed||0))],['AI estimate',money(data?.report.totals.estimated_usd||0)]].map(([label,value])=><Card key={label} className="dash-metric"><div><span>{label}</span><InfoTip text="Selected job and report activity dates only. Counts are events, including retries. AI estimates exclude unknown charges and AWS."/></div><strong>{data?value:'--'}</strong><small>{data?dateLabel(data.date):'Loading'} | Selected job</small></Card>)}
</section>}
      <div className="dashboard-body">
      <nav className="side-nav" aria-label="Dashboard sections">
      {([["overview","Overview"],["staging","Staging post"],["usage","Usage report"],["cost","Embedding cost"],["extraction","Extraction"],["aws","AWS estimation"],["comparison","Comparison"]] as const).map(([key,label])=>{
        if(source==="manual"&&key==="aws")return null;
        const locked=key==="extraction"&&!data?.extraction.length;
        return <TooltipProvider key={key}><Tooltip><TooltipTrigger render={<button type="button" className={tab===key?"selected":""} aria-current={tab===key?"page":undefined} aria-disabled={locked} onClick={()=>{if(!locked)changeTab(key);}}/>}>{locked&&<Lock size={14}/>}<span>{label}</span></TooltipTrigger>{locked&&<TooltipContent side="right">No extraction API records for this job in the selected report dates.</TooltipContent>}</Tooltip></TooltipProvider>;
      })}

      </nav>
      <section key={tab} className={tab === "comparison" ? "dash-content comparison-scroll" : "dash-content"} tabIndex={tab === "comparison" ? 0 : undefined} aria-label={tab === "comparison" ? "Job comparisons" : undefined} aria-busy={busy} aria-live="polite">
      {tab==="comparison" ? <JobComparison initialData={data} initialSource={source}/> : busy ? <div className="dash-skeleton" role="status"><span className="sr-only">Loading dashboard content</span><Skeleton className="h-8 w-48"/><div className="grid grid-cols-2 gap-4"><Skeleton className="h-24"/><Skeleton className="h-24"/></div><Skeleton className="h-10"/><Skeleton className="h-10"/><Skeleton className="h-10"/></div> : !data ? <div className="dash-empty">Monitoring data is unavailable. Retry the connection above.</div> : <>
        {tab==="overview"&&<DateOverview data={data}/>}
{tab==="staging"&&<StagingBrowser key={source+":"+data.job?._id+":"+data.date} data={data}/>}
        {tab==="usage"&&panel("Daily usage report",<><div className="flex flex-wrap items-center justify-between gap-3"><div className="report-subtitle"><strong>{dateLabel(data.date)||"No report dates"}</strong><span>{number(data.report.run_count)} executions</span><span>Activity date ? UTC+08</span></div><Button variant="outline" onClick={exportReport}><Download/>JSON report</Button></div>{detail==="summary"&&<div className="dash-report-stats"><span>Completed invocation records<strong>{completedRuns.toLocaleString()} | {data.report.run_count.toLocaleString()}</strong></span><span>API success rate<strong>{dailyCalls?(dailySuccess/dailyCalls*100).toFixed(2):"--"}%</strong></span><span>Input tokens | successful call<strong>{dailySuccess?Math.round(dailyApi.filter(a=>a.outcome==="api_succeeded").reduce((n,a)=>n+a.input_tokens,0)/dailySuccess).toLocaleString():"--"}</strong></span><span>Calls with unknown cost<strong>{data.report.totals.unknown_cost_calls} | {dailyCalls.toLocaleString()}</strong></span></div>}<div className="flex gap-2"><Button variant={detail==="summary"?"secondary":"ghost"} onClick={()=>setDetail("summary")}>Event totals</Button><Button variant={detail==="runs"?"secondary":"ghost"} onClick={()=>setDetail("runs")}>Per-run detail</Button></div>{detail==="runs"&&<div className="run-tools"><RunSearch source={source} onSelect={setInspectId}/><div className="run-filter"><DashboardSelect label="Invocation stage" value={runStage} onChange={v=>{setRunStage(v);setRunPage(1);}} options={[{value:"",label:"All worker stages"},...Array.from(new Set(data.report.runs.map(run=>run.stage))).filter(Boolean).sort().map(stage=>({value:stage,label:stage==="lambda-fetch"?"Fetch workers":stage==="lambda-embed"?"Embedding workers":stage}))]}/><span>{visibleRuns.length.toLocaleString()} matching runs</span></div></div>}<div className={"dash-table "+(detail==="summary"?"usage-summary":"report-table")}>{detail==="summary"?<div className="event-bars">{Object.entries(data.report.totals.counts).map(([key,value])=><div key={key} data-bar-tone={key}><span>{key.replaceAll("_"," ")}</span><div className="bar-track"><div style={{width:(value/Math.max(1,...Object.values(data.report.totals.counts))*100)+"%"}}/></div><strong>{number(value)}</strong></div>)}</div>:<Table aria-label="Per-run detail">
   <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Worker stage</TableHead><TableHead>Run UUID</TableHead></TableRow></TableHeader>
   <TableBody>{visibleRuns.slice((shownRunPage-1)*6,shownRunPage*6).map(run=><TableRow key={run.run_id} className="cursor-pointer" onClick={()=>setInspectId(run.run_id)}>
     <TableCell><Badge className={run.status==="completed"?"api-success":run.status==="failed"?"api-failure":"api-started"}>{run.status}</Badge></TableCell>
     <TableCell>{run.stage}</TableCell><TableCell><button type="button" className="record-link" aria-label={"Investigate run "+run.run_id}>{run.run_id}</button></TableCell>
   </TableRow>)}
   {!visibleRuns.length&&<TableRow><TableCell colSpan={3}>No matching runs.</TableCell></TableRow>}
   </TableBody></Table>}</div>
   {detail==="runs"&&<Pagination label="Per-run detail" page={shownRunPage} pages={runPages} onPage={setRunPage}/>}<div className="info-caption">About this report <InfoTip text="Matches the Python event-date report: includes runs started that day and earlier runs with events that day. Counts are events, not unique posts. Latest run status may change."/></div></>)}
        {tab==="cost"&&panel("Embedding API cost",<><p>{dateLabel(data.date)+" | Selected job | Includes unfinished calls"}</p><div className="dash-report-stats"><span>Known estimate | USD<strong>{money(cost)}</strong></span><span>Unknown-cost calls<strong>{number(unknown)}</strong></span><span>API calls<strong>{number(data.costs.reduce((n,c)=>n+c.count,0))}</strong></span><span>Input tokens<strong>{number(data.costs.reduce((n,c)=>n+c.input_tokens,0))}</strong></span></div><CostChart data={data}/><div className="dash-table report-table"><Table aria-label="Embedding API cost"><TableHeader><TableRow><TableHead>Outcome</TableHead><TableHead>Calls</TableHead><TableHead>Tokens</TableHead><TableHead>Estimate USD</TableHead><TableHead>Unknown</TableHead><TableHead>Rate version | usage</TableHead></TableRow></TableHeader><TableBody>{data.costs.slice((shownCostPage-1)*5,shownCostPage*5).map((c,i)=><TableRow key={i} className="clickable-api-row" tabIndex={0} aria-label={"View "+c._id.outcome+" details"} onClick={()=>{setApiPage(1);setApiDetailTab("call");setApiOutcome(c._id.outcome);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setApiPage(1);setApiDetailTab("call");setApiOutcome(c._id.outcome);}}}><TableCell><Button variant="ghost" className="h-auto p-0" onClick={()=>{setApiPage(1);setApiDetailTab("call");setApiOutcome(c._id.outcome);}} aria-label={"View "+c._id.outcome+" API calls"}><Badge className={c._id.outcome==="api_succeeded"?"api-success":c._id.outcome==="api_failed"?"api-failure":"api-started"}>{c._id.outcome}</Badge></Button></TableCell><TableCell>{number(c.count)}</TableCell><TableCell>{number(c.input_tokens)}</TableCell><TableCell>{money(c.estimated_usd)}</TableCell><TableCell>{c.unknown_cost_calls}</TableCell><TableCell>{c._id.pricing||"unspecified"}<p>{c._id.source}</p></TableCell></TableRow>)}{!data.costs.length&&<TableRow><TableCell colSpan={6}>No matching embedding API records.</TableCell></TableRow>}</TableBody></Table></div><Pagination label="Embedding API cost" page={shownCostPage} pages={costPages} onPage={setCostPage}/><div className="info-caption">How this estimate is calculated <InfoTip text="Stored embedding cost estimates for the selected job and report activity dates. Includes unfinished calls recorded in that period. Null costs remain unknown. AWS infrastructure and extraction costs are excluded."/></div></>)}

        {tab==="aws"&&<><p className="staging-scope-note">AWS estimates use saved job snapshots. The report activity date does not filter these exports.</p>{source==="fargate"?<FargateEstimates/>:<AwsEstimates key={data.job?.benchmark_id||"no-job"} benchmark={data.job?.benchmark_id} data={data}/>}</>}
        {tab==="extraction"&&panel("Extraction cost | selected job",data.extraction.length?<><p>Linked to {job?.benchmark_id}. Report activity: {dateLabel(data.date)}. Only records from the selected job and report dates.</p><div className="dash-table"><Table><TableHeader><TableRow><TableHead>Outcome</TableHead><TableHead>Calls</TableHead><TableHead>Input tokens</TableHead><TableHead>Output tokens</TableHead><TableHead>Known USD</TableHead><TableHead>Unknown</TableHead></TableRow></TableHeader><TableBody>{data.extraction.map((c,i)=><TableRow key={i}><TableCell><Badge className={c._id.outcome==="api_succeeded"?"api-success":"api-failure"}>{c._id.outcome}</Badge></TableCell><TableCell>{c.count}</TableCell><TableCell>{number(c.input_tokens)}</TableCell><TableCell>{number(c.output_tokens)}</TableCell><TableCell>{money(c.estimated_usd)}</TableCell><TableCell>{c.unknown_cost_calls}</TableCell></TableRow>)}</TableBody></Table></div></>:<p>No extraction API records are linked to this job.</p>)}
      </>}
      </section>
      </div>
      <Dialog open={apiOutcome!==null} onOpenChange={open=>{if(!open)setApiOutcome(null);}}><DialogContent className="api-dialog" onBackdropClick={()=>setApiOutcome(null)}><DialogHeader><DialogTitle>Embedding API | {apiOutcome}</DialogTitle><DialogDescription>Latest 25 calls for this outcome for the selected job and report activity dates. Across pricing groups. API success means the provider returned successfully; publication is a separate step.</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">{apiOutcome==="api_failed"?"Failed calls can still incur cost. The backend records exception types, not raw provider messages. A later retry may succeed.":apiOutcome==="started"?"These calls have no recorded final outcome; they may have been interrupted. Do not assume zero cost.":"Token values can be estimated when the provider does not return usage. Stored pricing determines the estimate."}</p>{apiOutcome==="api_failed"&&<div className="inspector-tabs"><Button variant={apiDetailTab==="call"?"secondary":"ghost"} onClick={()=>setApiDetailTab("call")}>Failed call</Button><Button variant={apiDetailTab==="followup"?"secondary":"ghost"} onClick={()=>setApiDetailTab("followup")}>Retry & current post</Button></div>}{apiLoading&&<Skeleton className="h-40 w-full"/>}{apiError&&<p role="alert">{apiError}</p>}<div className="space-y-3">{apiCalls.slice(apiPage-1,apiPage).map(call=><Card key={call._id} className="p-4 gap-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>Post {call.post_id}</strong><Badge className={apiOutcome==="api_succeeded"?"api-success":apiOutcome==="api_failed"?"api-failure":"api-started"}>{apiOutcome}</Badge></div><dl className="dash-facts">{(apiOutcome==="api_failed"&&apiDetailTab==="followup"?[["Current embedding",call.currentPost?.jobs?.embed?.status||"Not retained"],["Current publication",call.currentPost?.publish_status||"Not retained"],["Recorded attempts",String(call.currentPost?.jobs?.embed?.attempts??"Unknown")],["Later API outcome",call.laterAttempt?.outcome||"No later attempt recorded"],["Later attempt time",time(call.laterAttempt?.recorded_at)],["Later run ID",call.laterAttempt?.run_id||"None"]]:[["Model",call.model||"--"],["Recorded",time(call.recorded_at)],["Finished",time(call.finished_at)],["Duration",call.finished_at?duration((Date.parse(call.finished_at)-Date.parse(call.recorded_at))/1000):"Unfinished"],["Tokens (in | out)",(call.input_tokens??"unknown")+" | "+(call.output_tokens??"unknown")],["Estimated USD",call.estimated_cost_usd==null?"Unknown":money(call.estimated_cost_usd)],["Usage source",call.usage_source||"unavailable"],["Error type",call.error_type||"--"],["Run ID",call.run_id]]).map(([key,value])=><div key={key}><dt>{key}</dt><dd className="break-all">{value}</dd></div>)}</dl><Button variant="outline" onClick={()=>{setApiOutcome(null);setInspectId(call.run_id);}}>Investigate this run</Button>{apiDetailTab==="followup"&&<p className="text-xs">Current staging state and latest later API attempt for this post, across jobs. A failed API call can later succeed.</p>}</Card>)}</div><div className="dash-pagination"><Button variant="outline" disabled={apiLoading||apiPage===1} onClick={()=>setApiPage(apiPage-1)}>Previous</Button><span>Call {apiPage} of {apiCalls.length}</span><Button variant="outline" disabled={apiPage>=(data?.apiDetails[apiOutcome||""]?.length||0)} onClick={()=>setApiPage(apiPage+1)}>Next</Button></div></DialogContent></Dialog>
      <RunInspector source={source} key={inspectId||"closed"} id={inspectId} onClose={()=>setInspectId(null)}/>
      <footer className="dash-footer"><Badge variant="outline"><ShieldCheck size={12}/>Read only</Badge><div className="snapshot-status"><span><small>{data?.cache?.ttlSeconds===86400?"24-hour snapshot":"Last updated"}</small> {data?time(data.cache?.savedAt||data.refreshedAt):"Loading"}</span><span className="timezone-chip">UTC+08</span><Button size="sm" variant="ghost" disabled={pending} onClick={()=>void load(applied,false,true)}>Refresh from MongoDB</Button></div></footer>
    </div>
  </main>;
}
