import { NextRequest, NextResponse } from "next/server";
import snapshot from "../../../../data/cloudwatch/full-20261119-v1.json";
import { parseLambdaReports } from "@/lib/log-report";
import { parseCloudWatchCsv, invocationEvents } from "@/lib/cloudwatch-events";
export async function GET(request:NextRequest){
 const file=request.nextUrl.searchParams.get('file');
 const headers={"Cache-Control":"private, no-store"};
 if(file!==null){const index=Number(file);if(!/^\d$/.test(file)||!snapshot.files[index])return new NextResponse('File not found',{status:404});const entry=snapshot.files[index];return new NextResponse(entry.content,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${entry.name}"`}});}
 const requestId=request.nextUrl.searchParams.get('requestId');
 if(requestId){if(!/^[a-zA-Z0-9-]{1,80}$/.test(requestId))return NextResponse.json({error:'Invalid request ID'},{status:400});const files=snapshot.files.map(f=>({name:f.name,events:invocationEvents(parseCloudWatchCsv(f.content),requestId)})).filter(f=>f.events.length);return NextResponse.json({files},{headers});}
 const all=snapshot.files.flatMap(f=>parseLambdaReports(f.content));
 const rows=[...new Map(all.map(r=>[r.requestId,r])).values()];
 const timestamps=snapshot.files.flatMap(f=>[...f.content.matchAll(/^(\d{13}),/gm)].map(m=>Number(m[1])));
 return NextResponse.json({benchmark:snapshot.benchmark,partial:true,rows,duplicates:all.length-rows.length,start:Math.min(...timestamps),end:Math.max(...timestamps),files:snapshot.files.map((f,i)=>({name:f.name,url:'/api/aws-snapshot?file='+i,reports:parseLambdaReports(f.content).length}))},{headers});
}
