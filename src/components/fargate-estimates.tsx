"use client";
import { useEffect, useRef, useState } from "react";
import { parseFargateCsv, summarizeFargate, fargateUsage, type FargateEvent } from "@/lib/fargate-usage";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
type TaskEvidence = {source:string;taskId:string;cpu:number;memory:number;storage:number;pullStartedAt:string;startedAt:string;executionStoppedAt:string;stoppedAt:string;exitCode:number};
type Snapshot = {taskEvidence?:TaskEvidence;label:string;events:FargateEvent[];files:{name:string;url:string}[]};
export function FargateEstimates() {
  const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
  const [custom,setCustom] = useState(false);
  const [tab,setTab] = useState("summary"), [page,setPage] = useState(1);
  const [snapshotLoading,setSnapshotLoading] = useState(true);
  const [events,setEvents] = useState<FargateEvent[]>([]);
  const [files,setFiles] = useState<string[]>([]);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const [cpu,setCpu] = useState("2"), [memory,setMemory] = useState("4"), [storage,setStorage] = useState("20");
  const [cpuRate,setCpuRate] = useState("0.05056"), [memoryRate,setMemoryRate] = useState("0.00553"), [storageRate,setStorageRate] = useState("0.000133");
  const input = useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/fargate-snapshot",{signal:controller.signal,cache:"no-store"})
      .then(async r=>{if(!r.ok)throw Error("Unable to load saved Fargate snapshot");return r.json() as Promise<Snapshot>;})
      .then(value=>{setSnapshot(value);setEvents(value.events);setFiles(value.files.map(f=>f.name));})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Unable to load snapshot");})
      .finally(()=>{if(!controller.signal.aborted)setSnapshotLoading(false);});
    return()=>controller.abort();
  },[]);
  const summary = summarizeFargate(events);
  const evidence = custom ? undefined : snapshot?.taskEvidence;
  const lifecycleTasks = evidence ? [{stream:evidence.taskId,start:Date.parse(evidence.pullStartedAt),end:Date.parse(evidence.stoppedAt),seconds:(Date.parse(evidence.stoppedAt)-Date.parse(evidence.pullStartedAt))/1000,events:0}] : [];
  let usage: ReturnType<typeof fargateUsage> | null = null;
  try { usage = fargateUsage(evidence ? lifecycleTasks : summary.tasks,evidence?.cpu ?? Number(cpu),evidence?.memory ?? Number(memory),evidence?.storage ?? Number(storage)); } catch {}
  const validRate = (s:string) => s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) >= 0;
  const cost = usage && validRate(cpuRate) && validRate(memoryRate) && (!usage.storageHours || validRate(storageRate))
    ? usage.cpuHours * Number(cpuRate) + usage.memoryHours * Number(memoryRate) + usage.storageHours * Number(storageRate) : null;
  async function upload(list:FileList|null) {
    if (!list?.length) return;
    setLoading(true); setError("");
    try {
      const selected = Array.from(list);
      if (selected.length > 50 || selected.reduce((n,f)=>n+f.size,0) > 25*1024*1024) throw Error("Choose up to 50 CSVs, totalling at most 25 MB.");
      const parsed: FargateEvent[] = [];
      for (const f of selected) {
        if (!f.name.toLowerCase().endsWith(".csv")) throw Error("Only CSV files are supported.");
        try { parsed.push(...parseFargateCsv(await f.text())); } catch(e) { throw Error(f.name+": "+(e instanceof Error ? e.message : "Unable to read CSV")); }
      }
      setEvents(parsed); setFiles(selected.map(f=>f.name)); setCustom(true); setPage(1);
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to import CSVs"); }
    finally { setLoading(false); if(input.current) input.current.value=""; }
  }
  const time = (ms:number) => new Date(ms).toLocaleString("en-GB",{timeZone:"Asia/Kuala_Lumpur"});
  const sufficient = !!evidence || (!summary.unidentified && summary.events > 0);
  const money = (value:number) => "$"+value.toFixed(6);
  return <Card className="dash-panel aws-snapshot">
    <div className="panel-heading"><h2>AWS usage estimate</h2><span className="snapshot-label">{custom ? "Local import" : "Saved job snapshot"} | Partial coverage</span></div>
    <p>{custom ? files.join(" | ") : snapshot ? snapshot.label+" | "+snapshot.files.length+" original CloudWatch exports" : "Loading saved log snapshot..."}</p>
    {(loading||snapshotLoading)&&<p role="status">Loading log files...</p>}
    {error&&<p role="alert">{error} {files.length>0&&"Previous calculation remains visible."}</p>}
    <div className="inspector-tabs">
      <Button variant={tab==="summary"?"secondary":"ghost"} onClick={()=>setTab("summary")}>Usage summary</Button>
      <Button variant={tab==="cost"?"secondary":"ghost"} onClick={()=>setTab("cost")}>Job cost estimate</Button>
      <Button variant={tab==="files"?"secondary":"ghost"} onClick={()=>setTab("files")}>Files &amp; downloads</Button>
      <Button variant={tab==="records"?"secondary":"ghost"} onClick={()=>setTab("records")}>Task records</Button>
    </div>
    {tab==="summary"?<>
      <div className="dash-report-stats">
        <span>Unique log events<strong>{summary.events.toLocaleString()}</strong></span>
        <span>{evidence?"ECS runtime interval":"Observed activity span"}<strong>{(evidence?lifecycleTasks[0].seconds:summary.seconds).toFixed(2)} s</strong></span>
        <span>{evidence?"Tasks with ECS evidence":"Identified task streams"}<strong>{evidence?1:summary.unidentified?"Unknown":summary.tasks.length}</strong></span>
        <span>Peak used memory<strong>Not recorded</strong></span>
      </div>
      <div className="aws-coverage">
        <strong>Partial exports, not the full job bill</strong>
        <p>{evidence?"ECS lifecycle evidence covers one successful full-run task, from image pull to stopped. The CSVs remain unmapped to task streams; they are not used for this runtime estimate. Initialization and the earlier one-post test are excluded.":summary.unidentified?"These CSVs have no task/log-stream IDs. The observed span may include gaps between different runs; it is not task runtime. A reliable cost cannot be calculated from these exports alone.":"First-to-last log timestamps are activity estimates, not billed durations. Image pull, startup, shutdown and missing logs may be excluded."}</p>
        <small>{summary.duplicates} duplicate events removed. CSV completeness cannot be verified. This snapshot is independent of dashboard job/date filters.</small>
      </div>
    </>:tab==="cost"?<div className="usage-estimate">
      <div className="estimate-total">
        <span>Indicative task cost · before allowances and discounts</span>
        <strong>{!sufficient?"More runtime evidence needed":cost===null?"Enter valid allocation and rates":money(cost)}</strong>
        <small>{evidence?"One full-run task | ECS lifecycle runtime | 2 vCPU / 4 GiB / 20 GiB":`${files.length} exports | ${summary.events} unique events | Observed logs only`}</small>
      </div>
      <div className="service-estimates">
        <article><h3>Fargate CPU</h3><strong>{sufficient&&usage&&validRate(cpuRate)?money(usage.cpuHours*Number(cpuRate)):"Unavailable"}</strong><p>{evidence?.cpu ?? cpu} vCPU allocated. {evidence?"Estimated from ECS lifecycle timestamps.":"Estimated from observed task spans."}</p></article>
        <article><h3>Fargate memory</h3><strong>{sufficient&&usage&&validRate(memoryRate)?money(usage.memoryHours*Number(memoryRate)):"Unavailable"}</strong><p>{evidence?.memory ?? memory} GiB allocated. Actual memory usage is not recorded.</p></article>
        <article><h3>Extra storage</h3><strong>{sufficient&&usage&&validRate(storageRate)?money(usage.storageHours*Number(storageRate)):"Unavailable"}</strong><p>{evidence?.storage ?? storage} GiB allocated; only storage above 20 GiB is counted.</p></article>
      </div>
      <div className="observed-cost"><strong>Direct log evidence</strong><span>{summary.events} events | {summary.seconds.toFixed(2)} s activity span</span></div>
      <p className="estimate-note">Singapore Linux/x86 On-Demand rates, verified 24 Nov 2026. This is not a full AWS bill. Excludes Gemini, NAT EC2, Elastic IP, EBS, ECR, CloudWatch and data transfer. {evidence?"Includes only the supplied full-run task; initialization and the one-post test are excluded. ECS timestamps provide an estimate, not an AWS billing record.":"Missing task identities prevent a reliable runtime calculation."}</p>
      <details><summary>Allocation and pricing assumptions</summary>
        <div className="grid gap-4 sm:grid-cols-3">
          <label>Allocated vCPU<Input type="number" min="0.25" step="0.25" disabled={!!evidence} value={evidence?String(evidence.cpu):cpu} onChange={e=>setCpu(e.target.value)}/></label>
          <label>Allocated memory (GiB)<Input type="number" min="0.5" step="0.5" disabled={!!evidence} value={evidence?String(evidence.memory):memory} onChange={e=>setMemory(e.target.value)}/></label>
          <label>Ephemeral storage (GiB)<Input type="number" min="20" disabled={!!evidence} value={evidence?String(evidence.storage):storage} onChange={e=>setStorage(e.target.value)}/></label>
          <label>USD / vCPU-hour<Input type="number" min="0" step="any" value={cpuRate} onChange={e=>setCpuRate(e.target.value)}/></label>
          <label>USD / GiB-hour memory<Input type="number" min="0" step="any" value={memoryRate} onChange={e=>setMemoryRate(e.target.value)}/></label>
          <label>USD / GiB-hour extra storage<Input type="number" min="0" step="any" value={storageRate} onChange={e=>setStorageRate(e.target.value)}/></label>
        </div>
        <p>{evidence?"Allocation is fixed to the supplied ECS task JSON. Runtime uses pullStartedAt through stoppedAt, rounded up to whole seconds.":"Allocation applies to every identified task. Logged spans can omit startup or include idle gaps."} The Linux 60-second minimum applies per task.</p>
        {!usage&&<p role="alert">Enter positive CPU/memory and at least 20 GiB storage.</p>}
      </details>
      <div className="calculator-sources"><a href="https://aws.amazon.com/fargate/pricing/" target="_blank" rel="noreferrer">Fargate rates</a></div>
    </div>:tab==="files"?<>
      <div className="aws-toolbar">
        <Input ref={input} type="file" multiple accept=".csv" aria-label="Import Fargate CloudWatch CSV files" disabled={loading||snapshotLoading} onChange={e=>void upload(e.target.files)}/>
        {custom&&<Button variant="outline" disabled={loading||!snapshot} onClick={()=>{if(snapshot){setEvents(snapshot.events);setFiles(snapshot.files.map(f=>f.name));setCustom(false);setError("");setPage(1);}}}>Saved snapshot</Button>}
      </div>
      {snapshot&&<div className="snapshot-downloads">{snapshot.files.map((f,i)=><a key={f.url} href={f.url} download><span>Original export {i+1}</span><small>{f.name}</small><strong>Download CSV</strong></a>)}</div>}
      <a href="/api/fargate-snapshot?evidence=1" download>Download ECS task evidence (selected fields)</a>
      <p>Saved originals remain available. Custom imports replace only this browser snapshot.</p>
    </>:<>
      {evidence&&<div className="aws-coverage">
        <strong>ECS full-run task: {evidence.taskId}</strong>
        <p>{evidence.source}. Exit code: {evidence.exitCode}.</p>
        <p>Image pull started (MY): {time(Date.parse(evidence.pullStartedAt))}<br/>
        Container started (MY): {time(Date.parse(evidence.startedAt))}<br/>
        Execution stopped (MY): {time(Date.parse(evidence.executionStoppedAt))}<br/>
        Task stopped (MY): {time(Date.parse(evidence.stoppedAt))}</p>
        <p>Runtime interval: {lifecycleTasks[0].seconds.toFixed(3)} s. CSV rows below have not been assigned to this task.</p>
      </div>}
      <div className="dash-table report-table"><Table aria-label="Fargate task records">
        <TableHeader><TableRow>{["Task / log stream","First event (MY)","Last event (MY)","Activity span (s)"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{summary.tasks.slice((page-1)*4,page*4).map(t=><TableRow key={t.stream}><TableCell>{t.stream||"Unidentified — may contain multiple tasks"}</TableCell><TableCell>{time(t.start)}</TableCell><TableCell>{time(t.end)}</TableCell><TableCell>{t.seconds.toFixed(2)}</TableCell></TableRow>)}
        {!summary.tasks.length&&<TableRow><TableCell colSpan={4}>{snapshotLoading?"Loading task records...":"No task records available."}</TableCell></TableRow>}</TableBody>
      </Table></div>
      <Pagination label="Task records" page={page} pages={Math.ceil(summary.tasks.length/4)} onPage={setPage}/>
    </>}
    <small>Saved exports are included in this project and available behind dashboard authentication. New file imports stay in browser memory.</small>
  </Card>;
}