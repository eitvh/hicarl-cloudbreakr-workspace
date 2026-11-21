export interface ReportRow {requestId:string;durationMs:number;billedMs:number;memoryMb:number;maxMemoryMb:number}
export function parseLambdaReports(text:string):ReportRow[]{
 const rows:ReportRow[]=[];
 const pattern=/REPORT\s+RequestId:\s*([a-zA-Z0-9-]+)\s+Duration:\s*([\d.]+)\s*ms\s+Billed Duration:\s*([\d.]+)\s*ms\s+Memory Size:\s*([\d.]+)\s*MB\s+Max Memory Used:\s*([\d.]+)\s*MB/g;
 // CloudWatch JSON event exports wrap the text message in JSON strings.
 let source=text;
 try{
  const parsed=JSON.parse(text);
  const events=Array.isArray(parsed)?parsed:parsed.events;
  if(Array.isArray(events))source=events.map(e=>typeof e==="string"?e:e.message||"").join("\n");
 }catch{/* Plain text / CSV / JSONL are scanned as text. */}
 source=source.replaceAll("\\t"," ").replaceAll("\\n"," ");
 for(const m of source.matchAll(pattern)){
  const row={requestId:m[1],durationMs:Number(m[2]),billedMs:Number(m[3]),memoryMb:Number(m[4]),maxMemoryMb:Number(m[5])};
  if(Object.values(row).slice(1).every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0))rows.push(row);
 }
 return rows;
}
