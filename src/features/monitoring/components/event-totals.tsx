"use client";
import {useEffect,useRef,useState} from 'react';
import {Pagination} from '@/components/table-pagination';

export function EventTotals({counts}:{counts:Record<string,number>}){
 const ref=useRef<HTMLDivElement>(null);const [capacity,setCapacity]=useState(6),[page,setPage]=useState(0);
 const entries=Object.entries(counts),max=Math.max(1,...Object.values(counts));const pages=Math.max(1,Math.ceil(entries.length/capacity)),current=Math.min(page,pages-1);
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new ResizeObserver(()=>{const cols=el.clientWidth<600?1:2;const rows=Math.max(1,Math.floor(el.clientHeight/48));const full=rows*cols;const available=entries.length>full?Math.max(1,Math.floor((el.clientHeight-36)/48))*cols:full;setCapacity(available);});observer.observe(el);return()=>observer.disconnect();},[entries.length]);
 return <div ref={ref} className="event-totals-fit"><div className="event-bars">{entries.slice(current*capacity,(current+1)*capacity).map(([key,value])=><div key={key} data-bar-tone={key}><span>{key.replaceAll('_',' ')}</span><div className="bar-track"><div style={{width:value/max*100+'%'}}/></div><strong>{value.toLocaleString('en-US')}</strong></div>)}</div>{pages>1&&<div className="event-totals-pages"><Pagination label="Event totals" page={current+1} pages={pages} onPage={n=>setPage(n-1)}/></div>}</div>;
}
