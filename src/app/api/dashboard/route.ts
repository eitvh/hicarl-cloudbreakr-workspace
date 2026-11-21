import { dashboard } from "@/lib/dashboard";
import { mongoFailure } from "@/lib/mongo-diagnostics";
import { NextRequest, NextResponse } from "next/server";
export const maxDuration=60;
export async function GET(request: NextRequest) {
 const params=request.nextUrl.searchParams;
 try{return NextResponse.json(await dashboard(params),{headers:{"Cache-Control":"private, no-store"}});}
 catch(error){
  const failure=mongoFailure(error),reference=crypto.randomUUID();
  // Only allowlisted classifications; never log URI, credentials, raw messages or query contents.
  console.error('monitoring_read_failed',{reference,code:failure.code});
  return NextResponse.json({error:`${failure.code}: ${failure.hint} Reference: ${reference}`,code:failure.code,reference},{status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
