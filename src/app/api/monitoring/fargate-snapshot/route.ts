import { NextRequest, NextResponse } from "next/server";
import snapshot from "../../../../../data/cloudwatch/fargate-20261120.json";
import { parseFargateCsv } from "@/features/monitoring/lib/fargate-usage";
import taskEvidence from "../../../../../data/cloudwatch/fargate-task-evidence.json";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (request.nextUrl.searchParams.has("evidence")) return new NextResponse(JSON.stringify(taskEvidence,null,2), {headers:{...headers,"Content-Type":"application/json","Content-Disposition":'attachment; filename="fargate-task-evidence.json"'}});
  const file = request.nextUrl.searchParams.get("file");
  if (file !== null) {
    if (!/^[0-9]+$/.test(file) || !snapshot.files[Number(file)]) return new NextResponse("File not found", {status:404, headers});
    const entry = snapshot.files[Number(file)];
    return new NextResponse(entry.content, {headers:{...headers,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="'+entry.name+'"'}});
  }
  return NextResponse.json({
    label:snapshot.label, partial:true, taskEvidence,
    events:snapshot.files.flatMap(f=>parseFargateCsv(f.content)),
    files:snapshot.files.map((f,i)=>({name:f.name,url:"/api/monitoring/fargate-snapshot?file="+i}))
  },{headers});
}