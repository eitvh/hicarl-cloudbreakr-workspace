"use client";
import {useEffect,useState} from 'react';
import {flushSync} from 'react-dom';
import {Sun,Moon} from 'lucide-react';
import {Button} from '@/components/ui/button';
export function AppearanceControl(){
 const [dark,setDark]=useState(true);
 useEffect(()=>{const id=requestAnimationFrame(()=>setDark(document.documentElement.classList.contains('dark')));return()=>cancelAnimationFrame(id);},[]);
  function theme(event:React.MouseEvent<HTMLButtonElement>) {
    const root=document.documentElement;
    if(root.classList.contains('theme-reveal')||root.classList.contains('theme-fade'))return;
    const next=!root.classList.contains("dark");
    const apply=()=>{flushSync(()=>setDark(next));root.classList.toggle('dark',next);try{localStorage.setItem('monitor-theme',next?'dark':'light');}catch{}};
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){apply();return;}
    if(!document.startViewTransition){root.classList.add('theme-fade');apply();window.setTimeout(()=>root.classList.remove('theme-fade'),450);return;}
    const rect=event.currentTarget.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    root.style.setProperty('--theme-x',x+'px');root.style.setProperty('--theme-y',y+'px');root.style.setProperty('--theme-radius',Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+'px');root.classList.add('theme-reveal');
    const transition=document.startViewTransition(apply);void transition.finished.catch(()=>{}).finally(()=>root.classList.remove('theme-reveal'));
  }

 return <div className="flyout-appearance"><div><span>Appearance</span><small>{dark?'Dark mode':'Light mode'}</small></div><Button variant="outline" className="appearance-switch" onClick={theme} aria-label={dark?'Switch to light mode':'Switch to dark mode'}><span data-active={!dark}><Sun size={15}/></span><span data-active={dark}><Moon size={15}/></span></Button></div>;
}
