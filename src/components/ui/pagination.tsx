import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  label: string;
  page: number;
  pages: number;
  onPage: (page: number) => void;
};

export function Pagination({label,page,pages,onPage}: PaginationProps) {
  const last = Math.max(1,pages);
  const visible = [...new Set([1,page-1,page,page+1,last])]
    .filter(n=>n>=1 && n<=last).sort((a,b)=>a-b);

  return <nav data-slot="pagination" aria-label={label+" pagination"} className="table-pagination">
    <Button type="button" variant="ghost" size="sm" disabled={page<=1} onClick={()=>onPage(page-1)}>
      <ChevronLeft aria-hidden="true"/>Previous
    </Button>
    <ul data-slot="pagination-content" className="pagination-pages">
      {visible.map((n,i)=><li key={n} data-slot="pagination-item">
        {i>0 && n-visible[i-1]>1 && <MoreHorizontal size={14} aria-hidden="true"/>}
        <Button type="button" variant={n===page?"outline":"ghost"} size="sm" aria-label={"Page "+n}
          aria-current={n===page?"page":undefined} onClick={()=>{if(n!==page)onPage(n);}}>{n.toLocaleString()}</Button>
      </li>)}
    </ul>
    <span className="pagination-compact">Page {page.toLocaleString()} of {last.toLocaleString()}</span>
    <Button type="button" variant="ghost" size="sm" disabled={page>=last} onClick={()=>onPage(page+1)}>
      Next<ChevronRight aria-hidden="true"/>
    </Button>
  </nav>;
}
