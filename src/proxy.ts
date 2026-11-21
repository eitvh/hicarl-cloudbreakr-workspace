import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password && process.env.NODE_ENV !== "production") return NextResponse.next();
  if (!password) return new NextResponse("Set DASHBOARD_PASSWORD to enable this private dashboard.", {status:503});
  const auth = request.headers.get("authorization") || "";
  const decoded = auth.startsWith("Basic ") ? Buffer.from(auth.slice(6), "base64").toString() : "";
  const supplied = Buffer.from(decoded.slice(decoded.indexOf(":")+1));
  const expected = Buffer.from(password);
  if (supplied.length === expected.length && timingSafeEqual(supplied,expected)) return NextResponse.next();
  return new NextResponse("Authentication required", {status:401,headers:{"WWW-Authenticate":'Basic realm="Automation monitoring"'}});
}
export const config = {matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
