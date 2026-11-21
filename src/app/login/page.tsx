"use client";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2,LockKeyhole } from "lucide-react";
export default function LoginPage(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <main className="login-page"><Card className="login-card"><div className="login-brand"><Image src="/brand/cloudbreakr-symbol.png" alt="" width={48} height={48}/><strong>Cloudbreakr</strong></div><div><span className="login-eyebrow">INSTAGRAM AUTOMATION</span><h1>Welcome back</h1><p>Sign in to your pipeline monitoring dashboard.</p></div><form onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);setError('');try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.get('username'),password:form.get('password')})});const result=await r.json();if(!r.ok)throw Error(result.error);window.location.replace('/');}catch(e){setError(e instanceof Error?e.message:'Unable to sign in.');setBusy(false);}}}><label htmlFor="username">Username</label><Input id="username" name="username" autoComplete="username" required autoFocus disabled={busy}/><label htmlFor="password">Password</label><Input id="password" name="password" type="password" autoComplete="current-password" required disabled={busy}/>{error&&<p className="login-error" role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy?<><Loader2 className="animate-spin"/>Signing in...</>:<>Sign in<LockKeyhole size={16}/></>}</Button></form><small>Private dashboard | Read-only monitoring</small></Card></main>;
}
