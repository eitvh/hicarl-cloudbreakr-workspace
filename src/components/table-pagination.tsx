"use client";
import {Fragment} from 'react';
import {animatePanelChange} from '@/lib/panel-motion';
import {Pagination as Root,PaginationContent,PaginationItem,PaginationLink,PaginationPrevious,PaginationNext,PaginationEllipsis} from '@/components/ui/pagination';
type Props={label:string;page:number;pages?:number;hasNext?:boolean;disabled?:boolean;onPage:(page:number)=>void};
export function Pagination({label,page,pages,hasNext,disabled=false,onPage}:Props){
 const last=pages===undefined?undefined:Math.max(1,pages);const current=Math.max(1,last===undefined?page:Math.min(page,last));const visible=last===undefined?[current]:[...new Set([1,current-1,current,current+1,last])].filter(n=>n>=1&&n<=last).sort((a,b)=>a-b);
 const previousDisabled=disabled||current<=1,nextDisabled=disabled||(last===undefined?!hasNext:current>=last);
 const link=(target:number,blocked:boolean)=>({href:'#', 'aria-disabled':blocked||undefined,tabIndex:blocked?-1:0,onClick:(e:React.MouseEvent<HTMLAnchorElement>)=>{e.preventDefault();if(!blocked&&target!==current)animatePanelChange(()=>onPage(target));}});
 return <Root aria-label={label+' pagination'} className="table-pagination"><PaginationContent><PaginationItem><PaginationPrevious {...link(current-1,previousDisabled)}/></PaginationItem>{visible.map((n,i)=><Fragment key={n}>{i>0&&n-visible[i-1]>1&&<PaginationItem className="pagination-number"><PaginationEllipsis/></PaginationItem>}<PaginationItem className="pagination-number"><PaginationLink size="icon-sm" isActive={n===current} aria-label={'Page '+n} {...link(n,disabled)}>{n.toLocaleString()}</PaginationLink></PaginationItem></Fragment>)}<PaginationItem className="pagination-compact"><span>Page {current}{last!==undefined?' of '+last.toLocaleString():''}</span></PaginationItem><PaginationItem><PaginationNext {...link(current+1,nextDisabled)}/></PaginationItem></PaginationContent></Root>;
}
