"use client";
import { useEffect, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { Activity, Clock3 } from "lucide-react";
import { jobStatus, sourceLabel, type PipelineSource } from "@/lib/pipeline-source";
import { LatestActivity } from "@/components/latest-activity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const postDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
const startTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "Asia/Kuala_Lumpur",
});

function postWindow(from: string, until: string) {
  const first = new Date(from);
  const last = new Date(until);
  if (!Number.isFinite(first.getTime())) return "Not recorded";
  if (!Number.isFinite(last.getTime()) || last <= first) return postDate.format(first);
  return postDate.formatRange(first, last);
}

export function ActivityStatus({source,data,error}:{source:PipelineSource;data:DashboardData|null;error:string}) {
  const [other,setOther] = useState<DashboardData|null>(null);
  const [otherUnavailable,setOtherUnavailable] = useState(false);
  const otherSource = source === "lambda" ? "fargate" : "lambda";

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/dashboard?view=live&source="+otherSource, {signal:controller.signal,cache:"no-store"});
        if (!response.ok) throw Error();
        const snapshot: DashboardData = await response.json();
        if (!controller.signal.aborted) { setOther(snapshot); setOtherUnavailable(false); }
      } catch {
        if (!controller.signal.aborted) setOtherUnavailable(true);
      } finally { loading = false; }
    }
    void refresh();
    const timer = setInterval(refresh,120_000);
    return () => { controller.abort(); clearInterval(timer); };
  },[otherSource]);

  return <>
    {[{data, unavailable:Boolean(error)}, {data:other, unavailable:otherUnavailable}].map(p => p.data?.job && (
      <LiveProcess key={p.data.source + "/" + p.data.job._id} data={p.data} unavailable={p.unavailable}/>
    ))}
  </>;
}

function LiveProcess({data, unavailable}:{data:DashboardData; unavailable:boolean}) {
  const state = data.activity.state;
  const running = !unavailable && ["fetching","embedding","attention"].includes(state);
  const [seenRunning, setSeenRunning] = useState(running);
  const [open, setOpen] = useState(false);
  if (running && !seenRunning) setSeenRunning(true);

  const finishing = seenRunning && !unavailable && state === "completed";
  useEffect(() => {
    if (!finishing) return;
    const timer = setTimeout(() => setSeenRunning(false), 4000);
    return () => clearTimeout(timer);
  }, [finishing]);

  if (!running && !finishing) {
    if (open) setOpen(false);
    return null;
  }
  const job = data.job;
  if (!job) return null;
  const name = sourceLabel(data.source);
  const phase = state === "fetching" ? "Fetching source posts"
    : state === "embedding" ? "Processing staged posts for embedding and publication"
    : state === "attention" ? "Review failed embeddings" : "";
  const started = new Date(job.created_at);
  return <>
    {finishing
      ? <span role="status" className="activity-indicator live-indicator live-completion">{name} completed</span>
      : <Button variant="ghost" className="activity-indicator live-indicator active" onClick={()=>setOpen(true)} aria-haspopup="dialog"><i/>Live &middot; {name}</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="live-dialog" onBackdropClick={()=>setOpen(false)}>
      <DialogHeader className="process-header">
        <div className="process-heading">
          <div className="process-symbol" aria-hidden="true"><Activity size={25}/></div>
          <div>
            <DialogTitle className="process-title">Instagram post ingestion and embedding</DialogTitle>
            <div className="process-state"><i aria-hidden="true"/>{name} &middot; {jobStatus(state)}{phase && <> &mdash; {phase}</>}</div>
          </div>
        </div>
        <dl className="process-job-details">
          <div><dt>Post dates</dt><dd>{postWindow(job.date_from, job.date_until)}</dd></div>
          <div><dt>Job started</dt><dd>{Number.isFinite(started.getTime()) ? startTime.format(started)+" MYT" : "Not recorded"}</dd></div>
          {data.source === "lambda" && job.benchmark_id && <div><dt>Benchmark</dt><dd>{job.benchmark_id}</dd></div>}
        </dl>
        <DialogDescription className="process-timestamp">
          <Clock3 size={14} aria-hidden="true"/>
          <span>Updated <time dateTime={data.refreshedAt}>{new Date(data.refreshedAt).toLocaleTimeString("en-GB",{timeZone:"Asia/Kuala_Lumpur"})}</time> MYT</span>
          <span className="process-cadence">Every 2 minutes</span>
        </DialogDescription>
      </DialogHeader>
      {finishing
        ? <p role="status" className="live-completion">{name} completed</p>
        : <LatestActivity data={data}/>}
    </DialogContent></Dialog>
  </>;
}
