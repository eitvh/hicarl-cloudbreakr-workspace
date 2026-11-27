"use client";
import {useEffect,useState} from 'react';
import {WorkspaceHeader} from '@/components/layout/workspace-header';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {BookOpen,Cloud,SlidersHorizontal,ChartNoAxesCombined,Activity,Coins,LifeBuoy} from 'lucide-react';
const sectionIcons=[BookOpen,Cloud,SlidersHorizontal,ChartNoAxesCombined,Activity,Coins,LifeBuoy];
const descriptions=['How post monitoring works','Automated and manual runs','Find the right job and attempt','Posts, outcomes and API usage','Follow processing stages','Understand AI estimates','Resolve common issues'];
export function DocumentationHeader({contents}:{contents:string[][]}){
 const [section,setSection]=useState('overview');
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('.docs-guide');if(!root)return;
  let frame=0,locked='',timer:ReturnType<typeof setTimeout>|undefined;
  const highlight=(id:string)=>{setSection(id);document.querySelectorAll('.docs-navigation a[href^="#"]').forEach(link=>{if(link.getAttribute('href')==='#'+id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});};
  const go=(id:string)=>{const target=document.getElementById(id);if(!target||!contents.some(([key])=>key===id))return;locked=id;highlight(id);clearTimeout(timer);const header=document.querySelector('.docs-sticky-header');const offset=(header?.getBoundingClientRect().height||70)+36;root.scrollTo({top:root.scrollTop+target.getBoundingClientRect().top-root.getBoundingClientRect().top-offset,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});timer=setTimeout(()=>{locked='';},1100);};
  const update=()=>{frame=0;if(locked)return;const top=(document.querySelector('.docs-sticky-header')?.getBoundingClientRect().bottom||0)+48;let current=contents[0][0];for(const [id] of contents){const el=document.getElementById(id);if(el&&el.getBoundingClientRect().top<=top)current=id;}highlight(current);};
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const release=()=>{locked='';clearTimeout(timer);};
  const request=(event:Event)=>{const id=(event as CustomEvent<string>).detail;if(location.hash!=='#'+id)history.pushState(null,'','#'+id);go(id);};
  const click=(event:Event)=>{const anchor=(event.target as HTMLElement).closest<HTMLAnchorElement>('.docs-navigation a[href^="#"]');if(anchor){event.preventDefault();window.dispatchEvent(new CustomEvent('docs-navigate',{detail:anchor.hash.slice(1)}));}};
  const hash=()=>go(location.hash.slice(1));
  const initial=requestAnimationFrame(()=>{if(location.hash)hash();else update();});
  root.addEventListener('scroll',scroll,{passive:true});root.addEventListener('wheel',release,{passive:true});root.addEventListener('touchstart',release,{passive:true});root.addEventListener('keydown',release);root.addEventListener('click',click);window.addEventListener('docs-navigate',request);window.addEventListener('hashchange',hash);window.addEventListener('popstate',hash);
  return()=>{cancelAnimationFrame(initial);cancelAnimationFrame(frame);clearTimeout(timer);root.removeEventListener('scroll',scroll);root.removeEventListener('wheel',release);root.removeEventListener('touchstart',release);root.removeEventListener('keydown',release);root.removeEventListener('click',click);window.removeEventListener('docs-navigate',request);window.removeEventListener('hashchange',hash);window.removeEventListener('popstate',hash);};
 },[contents]);
 function navigate(id:string){window.dispatchEvent(new CustomEvent('docs-navigate',{detail:id}));}
 const index=Math.max(0,contents.findIndex(([id])=>id===section));const Icon=sectionIcons[index];
 return <header className="pipeline-header docs-sticky-header"><WorkspaceHeader>{null}</WorkspaceHeader><div className="docs-mobile-sections"><span className="docs-section-caption"><BookOpen size={15}/>Documentation</span><Select value={section} items={contents.map(([value,label])=>({value,label}))} onValueChange={value=>{if(value)navigate(String(value))}}><SelectTrigger className="docs-section-trigger" aria-label="Choose documentation section"><span className="docs-section-emblem"><Icon size={17}/></span><SelectValue>{contents[index][1]}</SelectValue></SelectTrigger><SelectContent className="docs-section-popup" align="end" sideOffset={8} alignItemWithTrigger={false}>{contents.map(([id,label],i)=>{const ItemIcon=sectionIcons[i];return <SelectItem value={id} key={id} className="docs-section-option"><span className="docs-option-icon"><ItemIcon size={17}/></span><span className="docs-option-copy"><strong>{label}</strong><small>{descriptions[i]}</small></span></SelectItem>})}</SelectContent></Select></div></header>;
}
