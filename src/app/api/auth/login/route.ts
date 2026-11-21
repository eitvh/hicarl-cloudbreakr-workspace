import { NextRequest,NextResponse } from "next/server";
import { createSession,credentialsMatch,SESSION_COOKIE,SESSION_SECONDS } from "@/lib/auth";
export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Invalid request origin.'},{status:403});
 if(Number(request.headers.get('content-length')||0)>4096)return NextResponse.json({error:'Request too large.'},{status:413});
 let body;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
 if(typeof body?.username!=='string'||typeof body?.password!=='string'||body.username.length>256||body.password.length>1024||!credentialsMatch(body.username,body.password))return NextResponse.json({error:'Incorrect username or password.'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});response.cookies.set(SESSION_COOKIE,createSession(),{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:SESSION_SECONDS});return response;}catch{return NextResponse.json({error:'Sign-in configuration is unavailable. Set DASHBOARD_SESSION_SECRET on the server.'},{status:503});}
}
