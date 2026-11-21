import { dashboard } from "@/lib/dashboard";
import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await dashboard(request.nextUrl.searchParams),{headers:{"Cache-Control":"private, no-store"}});
  } catch {
    return NextResponse.json({error:"Unable to read monitoring data. Check MongoDB configuration and network access."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
