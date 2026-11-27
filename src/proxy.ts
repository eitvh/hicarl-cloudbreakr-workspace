import { NextRequest,NextResponse } from "next/server";
import { SESSION_COOKIE,validSession } from "@/lib/auth";
export function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==='/documentation'||path==='/login'||path==='/api/auth/login'||path==='/api/auth/logout'||path.startsWith('/brand/'))return NextResponse.next();
 if(validSession(request.cookies.get(SESSION_COOKIE)?.value))return NextResponse.next();
 if(path.startsWith('/api/'))return NextResponse.json({error:'Please sign in to continue.'},{status:401,headers:{'Cache-Control':'no-store'}});
 return NextResponse.redirect(new URL('/login',request.url));
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
