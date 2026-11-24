export type FargateEvent = { timestamp: number; message: string; stream: string };
export type TaskSpan = { stream: string; start: number; end: number; events: number; seconds: number };
export function parseFargateCsv(text: string): FargateEvent[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if (c === "\n" && !quoted) { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (quoted) throw Error("CSV contains an unclosed quoted field.");
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const headers = (rows[0] || []).map(v => v.replace(/^\uFEFF/, "").trim().toLowerCase());
  const ti = headers.findIndex(v => ["timestamp", "@timestamp", "time"].includes(v));
  const mi = headers.findIndex(v => ["message", "@message"].includes(v));
  const si = headers.findIndex(v => ["logstream", "@logstream", "log stream", "log_stream"].includes(v));
  if (ti < 0 || mi < 0) throw Error("Expected CloudWatch CSV headers: timestamp and message (or @timestamp and @message).");
  const events: FargateEvent[] = [];
  for (const r of rows.slice(1)) {
    if (r.every(v => !v.trim())) continue;
    const raw = r[ti]?.trim() || "";
    // CloudWatch exports use epoch milliseconds or UTC timestamps.
    const iso = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?$/.test(raw) ? raw.replace(" ", "T") + "Z" : raw;
    const timestamp = /^\d{13}$/.test(raw) ? Number(raw) : Date.parse(iso);
    if (!Number.isFinite(timestamp) || r[mi] === undefined) throw Error("A CSV row has an invalid timestamp or missing message.");
    if (/\bREPORT RequestId:/.test(r[mi])) throw Error("This file contains Lambda REPORT logs. Upload ECS/Fargate logs instead.");
    events.push({ timestamp, message: r[mi], stream: si >= 0 ? r[si]?.trim() || "" : "" });
  }
  if (!events.length) throw Error("No log events found in this CSV.");
  return events;
}
export function summarizeFargate(events: FargateEvent[]) {
  const unique = new Map(events.map(e => [JSON.stringify([e.stream, e.timestamp, e.message]), e]));
  const groups = new Map<string, TaskSpan>();
  for (const e of unique.values()) {
    const current = groups.get(e.stream);
    if (current) { current.start = Math.min(current.start, e.timestamp); current.end = Math.max(current.end, e.timestamp); current.events++; }
    else groups.set(e.stream, { stream: e.stream, start: e.timestamp, end: e.timestamp, events: 1, seconds: 0 });
  }
  const tasks = [...groups.values()].map(t => ({ ...t, seconds: (t.end - t.start) / 1000 }));
  return { tasks, events: unique.size, duplicates: events.length - unique.size, seconds: tasks.reduce((n,t) => n + t.seconds, 0), unidentified: groups.has("") };
}
export function fargateUsage(tasks: TaskSpan[], cpu: number, memory: number, storage: number) {
  if (![cpu, memory, storage].every(Number.isFinite) || cpu <= 0 || memory <= 0 || storage < 20) throw Error("Enter positive CPU/memory and at least 20 GiB storage.");
  // Linux Fargate has a 60-second minimum per task. Actual lifecycle is not in application logs.
  const seconds = tasks.reduce((n,t) => n + Math.max(60, Math.ceil(t.seconds)), 0);
  return { seconds, cpuHours: seconds * cpu / 3600, memoryHours: seconds * memory / 3600, storageHours: seconds * Math.max(0, storage - 20) / 3600 };
}