"use client";
import { useState } from "react";
import { LogOut,Loader2 } from "lucide-react";
export function LogoutButton(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div className="sidebar-logout"><button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw Error();window.location.replace('/login');}catch{setError('Unable to log out. Try again.');setBusy(false);}}}>{busy?<Loader2 size={16} className="animate-spin"/>:<LogOut size={16}/>}<span>{busy?'Logging out...':'Logout'}</span></button>{error&&<small role="alert">{error}</small>}</div>;
}
