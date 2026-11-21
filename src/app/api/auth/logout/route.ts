import { NextRequest,NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Invalid request origin.'},{status:403});
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:0});return response;
}
