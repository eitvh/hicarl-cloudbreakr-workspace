"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { Card } from "@/components/ui/card";

const postLabels: Record<string,string> = {synced:"Synced posts", embedding_completed:"Embedding completed", embedding_skipped:"Embedding skipped", embedding_failed:"Embedding failed", published:"Published posts"};
const ai = "AI estimation cost (USD)";
const avg = "Average AI cost per processed post (USD)";
const aws = "AWS runtime estimate (USD)";
const control = "w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm";
type Selection = { approach: string; country: string; job: string; date: string };
const empty: Selection = { approach: "", country: "", job: "", date: "" };

function ComparisonTable({ index, remove }: { index: number; remove?: () => void }) {
  const [selected, setSelected] = useState(empty);
  const [manualValues, setManualValues] = useState<Record<string,string>>({});
  const [snapshot, setSnapshot] = useState<{ key: string; data?: DashboardData; error?: string }>();
  const [retry, setRetry] = useState(0);
  const { approach, country, job, date } = selected;
  const manual = approach === "manual";
  const key = approach && !manual && country === "hk"
    ? new URLSearchParams({ source: approach, job, view: "comparison" }).toString() : "";
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/dashboard?" + key, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw Error();
        const data: DashboardData = await response.json();
        if (!controller.signal.aborted) setSnapshot({ key, data });
      } catch {
        if (!controller.signal.aborted) setSnapshot({ key, error: "Could not load job data." });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, retry]);
  const current = snapshot?.key === key ? snapshot : undefined;
  const data = current?.data;
  const timeline = data?.job?._id === job ? data.timeline : [];
  const days = data?.job?._id === job ? data.comparison : [];
  const day = days.find(d => d.date === date);
  const dates = [...new Set([...days.map(d => d.date), ...timeline.map(point => point._id.slice(0, 10))])].sort().reverse();
  const points = timeline.filter(point => point._id.slice(0, 10) === date);
  const totals = points.reduce((sum, point) => ({
    calls: sum.calls + point.calls, failed: sum.failed + point.failed,
    tokens: sum.tokens + point.tokens, cost: sum.cost + point.cost,
  }), { calls: 0, failed: 0, tokens: 0, cost: 0 });
  const postKeys = [...new Set([...Object.keys(postLabels), ...Object.keys(day?.posts ?? {})])];
  const metrics = ["Processed posts", ...postKeys.map(k => postLabels[k] ?? k.replaceAll("_"," ")), "API calls", "Failed API calls", "Input tokens", ai, avg, aws];
  const processed = manual ? Number(manualValues["Processed posts"]) : day?.processed ?? 0;
  const cost = manual ? Number(manualValues[ai] || NaN) : totals.cost;
  const average = processed > 0 && Number.isFinite(cost) ? (cost/processed).toFixed(6) : "\u2014";
  const values = [processed, ...postKeys.map(k => day?.posts[k] ?? 0), totals.calls, totals.failed, totals.tokens, totals.cost.toFixed(6), average, day?.aws?.toFixed(6) ?? "Unavailable"];
  function change(update: Partial<Selection>) {
    setSelected({ ...selected, ...update });
    setManualValues({});
  }
  const unavailable = approach && country && !manual && country !== "hk";
  return <Card className="comparison-card min-w-0 p-4">
    <div className="flex justify-between gap-2"><h3 className="font-semibold">Job comparison {index}</h3>{remove && <button type="button" className="text-sm underline" aria-label={"Remove comparison "+index} onClick={remove}>Remove</button>}</div>
    <div className="comparison-filters">
    <label>Approach<select className={control} value={approach} onChange={e => change({ ...empty, approach: e.target.value })}>
      <option value="">Select approach</option><option value="manual">Manual</option><option value="lambda">Lambda</option><option value="fargate">Fargate</option>
    </select></label>
    <label>Country<select className={control} value={country} disabled={!approach} onChange={e => change({ country: e.target.value, job: "", date: "" })}>
      <option value="">Select country</option><option value="hk">Hong Kong</option><option value="my">Malaysia</option><option value="sg">Singapore</option>
    </select></label>
    <label>Job{manual ? <input className={control} disabled={!country} value={job} placeholder="Enter job name" onChange={e => change({ job: e.target.value, date: "" })}/> :
      <select className={control} value={job} disabled={!data?.jobs.length} onChange={e => change({ job: e.target.value, date: "" })}>
        <option value="">Select job</option>{data?.jobs.map(j => <option key={j._id} value={j._id}>{j.benchmark_id} · {j.date_from} – {j.date_until} · {j._id}</option>)}
      </select>}</label>
    <label>Activity date{manual ? <input type="date" className={control} disabled={!job.trim()} value={date} onChange={e => change({ date: e.target.value })}/> :
      <select className={control} disabled={!dates.length} value={date} onChange={e => change({ date: e.target.value })}>
        <option value="">Select date</option>{dates.map(day => <option key={day}>{day}</option>)}
      </select>}</label>
    </div>
    <div role="status" className="text-sm text-muted-foreground">{unavailable ? "No connected pipeline for this country." : current?.error ?
      <>{current.error} <button className="underline" onClick={() => { setSnapshot(undefined); setRetry(retry + 1); }}>Retry</button></> :
      key && !current ? "Loading jobs and usage…" : data && !data.jobs.length ? "No jobs available." :
      job && data && !dates.length ? "No recorded activity for this job." : manual && date ? "Enter the figures from your manual run." : null}</div>
    <table className="comparison-metrics w-full"><caption className="sr-only">Statistics and costs for comparison {index}</caption>
      <thead><tr><th className="text-left">Metric</th><th className="text-right">Value</th></tr></thead>
      <tbody>{metrics.map((metric, i) => <tr className="border-t" key={metric}><th scope="row" className="py-2 text-left font-normal">{metric}</th>
        <td className="text-right">{manual && date && metric === avg ? average : manual && date ? <input type="number" min="0" step={metric === ai || metric === aws ? "any" : "1"} className={control} aria-label={metric} value={manualValues[metric] ?? ""} onChange={e => { setManualValues({ ...manualValues, [metric]: e.target.value }); }}/> :
          date && (day || points.length) ? values[i].toLocaleString() : "—"}</td></tr>)}</tbody>
    </table>
  </Card>;
}

export function JobComparison() {
  const [tables, setTables] = useState([1, 2, 3]);
  const nextId = useRef(4);
  return <section aria-label="Comparison" className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Comparison</h2>
      <button type="button" disabled={tables.length >= 4} className="rounded-md border px-3 py-1 disabled:opacity-50" onClick={() => setTables([...tables,nextId.current++])}>Add comparison</button></div>
    <details className="comparison-notes"><summary>How counts and costs are calculated</summary><p>Processed posts count distinct posts with an embedding outcome or publication on the selected day (UTC+08). Average AI cost divides known API estimates by processed posts.</p>
    <p className="text-sm text-muted-foreground">AWS estimates use finished runs grouped by start date. The model assumes 1 GB x86 per Lambda invocation or one 2 vCPU, 4 GiB Fargate task per run. Other AWS services are excluded.</p></details>
    <div className="comparison-grid">{tables.map((id,i) => <ComparisonTable key={id} index={i+1} remove={tables.length > 2 ? () => setTables(tables.filter(t => t !== id)) : undefined}/>)}</div>
  </section>;
}
