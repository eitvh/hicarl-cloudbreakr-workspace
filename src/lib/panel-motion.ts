"use client";
import {flushSync} from 'react-dom';
let active:ViewTransition|undefined;
export function animatePanelChange(update:()=>void){
 if(typeof document==='undefined'||matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('theme-reveal')){update();return;}
 const dialog=Array.from(document.querySelectorAll<HTMLElement>('[data-slot="dialog-content"]')).at(-1);
 if(dialog){
  // Dialogs are top-layer elements. Animate their content, never snapshot the shell.
  active?.skipTransition();
  flushSync(update);
  const content=dialog.querySelector<HTMLElement>('.inspector-body, .popup-transition, .space-y-3, .search-results');
  if(content){content.getAnimations().forEach(animation=>animation.cancel());content.animate([{opacity:.55,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'cubic-bezier(.22,1,.36,1)'});}
  return;
 }
 if(!document.startViewTransition){update();return;}
 if(active){active.skipTransition();update();return;}
 const find=()=>document.querySelector<HTMLElement>('.dash-content');
 const before=find();if(!before){update();return;}
 before.style.viewTransitionName='workspace-panel';document.documentElement.classList.add('panel-motion-active');let after:HTMLElement|null|undefined;
 const transition=document.startViewTransition(()=>{flushSync(update);after=find();if(after)after.style.viewTransitionName='workspace-panel';});active=transition;
 void transition.finished.catch(()=>{}).finally(()=>{before.style.viewTransitionName='';if(after)after.style.viewTransitionName='';document.documentElement.classList.remove('panel-motion-active');if(active===transition)active=undefined;});
}
