import { pipelineSource } from "@/lib/pipeline-source";
﻿import { NextRequest, NextResponse } from "next/server";
import { inspectRun } from "@/lib/dashboard";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const source=pipelineSource(request.nextUrl.searchParams.get("source"));
 if(!source)return NextResponse.json({error:"Unknown pipeline source."},{status:400});
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:"Enter a valid run UUID."},{status:400});
 try{
  const page=Math.max(1,Math.min(10000,parseInt(request.nextUrl.searchParams.get("page")||"1")||1));
  const result=await inspectRun(id,page,source);
  return NextResponse.json(result||{error:"Run not found in this HK pipeline."},{status:result?200:404,headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Unable to read this run. Try again."},{status:503});}
}
