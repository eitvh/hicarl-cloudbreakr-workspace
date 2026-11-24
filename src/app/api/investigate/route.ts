import { pipelineSource } from "@/lib/pipeline-source";
import { NextRequest,NextResponse } from "next/server";
import { findRuns } from "@/lib/dashboard";
export async function GET(request:NextRequest){
 const source=pipelineSource(request.nextUrl.searchParams.get("source"));
 if(!source)return NextResponse.json({error:"Unknown pipeline source."},{status:400});
 const kind=request.nextUrl.searchParams.get("kind")||"post",query=request.nextUrl.searchParams.get("q")||"";
 if(!["post","user"].includes(kind)||!/^\d{1,30}$/.test(query))return NextResponse.json({error:"Enter a numeric post or user ID."},{status:400});
 try{return NextResponse.json(await findRuns(kind,query,source),{headers:{"Cache-Control":"private, no-store"}});}catch{return NextResponse.json({error:"Search could not finish. Try a post ID or run UUID."},{status:503});}
}
