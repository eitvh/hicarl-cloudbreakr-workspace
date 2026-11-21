"use client";
import { useEffect, useState, type ReactNode } from "react";
export function PopupTransition({children}:{children:ReactNode}){
 const [ready,setReady]=useState(false);
 useEffect(()=>{const t=setTimeout(()=>setReady(true),120);return()=>clearTimeout(t);},[]);
 return <div className="popup-transition" aria-busy={!ready}>{ready?children:<div role="status" aria-label="Loading details" className="popup-skeleton"><i/><i/><i/></div>}</div>;
}
