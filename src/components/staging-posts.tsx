"use client";
import { useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardSelect } from "@/components/dashboard-select";
import { CopyCode } from "@/components/copy-code";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { CaptionContent } from "@/components/caption-viewer";
import { PopupTransition } from "@/components/popup-transition";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
type Post=DashboardData['posts'][number];
export type PostFilters={postId:string;userId:string;publication:string;status:string};
export function StagingPosts({data,filters,onFilter,onPage}:{data:DashboardData;filters:PostFilters;onFilter:(f:PostFilters)=>void;onPage:(p:number)=>void}){
 const [draft,setDraft]=useState(filters),[post,setPost]=useState<Post|null>(null),[tab,setTab]=useState("summary");
 const style=(value?:string)=>["completed","published"].includes(value||"")?"api-success":value==="failed"?"api-failure":"api-started";
 const date=(v?:string)=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Asia/Hong_Kong'}):'Not recorded';
 return <Card className="dash-panel staging-panel"><div className="panel-heading"><h2>Staging posts</h2><small>{data.postCount.toLocaleString()} matching posts</small></div><form className="post-filters" onSubmit={e=>{e.preventDefault();onFilter(draft);}}><Input aria-label="Post ID filter" placeholder="Post ID (exact)" inputMode="numeric" pattern="[0-9]*" value={draft.postId} onChange={e=>setDraft({...draft,postId:e.target.value})}/><Input aria-label="User ID filter" placeholder="User ID (exact)" inputMode="numeric" pattern="[0-9]*" value={draft.userId} onChange={e=>setDraft({...draft,userId:e.target.value})}/><DashboardSelect label="Embedding status" value={draft.status} onChange={status=>setDraft({...draft,status})} options={["","pending","processing","completed","failed","skipped"].map(value=>({value,label:value||"All embedding states"}))}/><DashboardSelect label="Publication status" value={draft.publication} onChange={publication=>setDraft({...draft,publication})} options={["","pending","published","failed","skipped"].map(value=>({value,label:value||"All publication states"}))}/><Button type="submit">Filter</Button><Button variant="ghost" type="button" onClick={()=>{const reset={postId:"",userId:"",publication:"",status:""};setDraft(reset);onFilter(reset);}}>Reset</Button></form>
 <div className="dash-table report-table">
   <Table aria-label="Staging posts"><TableHeader><TableRow>
     {["Post and author","Caption preview","Embedding","Publication","Attempts"].map(h=><TableHead key={h}>{h}</TableHead>)}
   </TableRow></TableHeader><TableBody>
     {data.posts.map(p=><TableRow key={p._id} className="cursor-pointer" onClick={()=>{setPost(p);setTab("summary");}}>
       <TableCell><button type="button" className="record-link" aria-label={"View post "+p.post_id}>Post {p.post_id}</button>
         <small className="record-author">User {p.user_id||"Not recorded"}</small></TableCell>
       <TableCell><span className="table-caption-preview">{p.caption||"No caption"}</span></TableCell>
       <TableCell><Badge className={style(p.jobs?.embed?.status)}>{p.jobs?.embed?.status||"Unknown"}</Badge></TableCell>
       <TableCell><Badge className={style(p.publish_status)}>{p.publish_status||"Unknown"}</Badge></TableCell>
       <TableCell>{p.jobs?.embed?.attempts||0}</TableCell>
     </TableRow>)}
     {!data.posts.length&&<TableRow><TableCell colSpan={5}>No posts match these filters.</TableCell></TableRow>}
   </TableBody></Table>
 </div>
 <Pagination label="Staging posts" page={data.page} pages={Math.ceil(data.postCount/5)} onPage={onPage}/>
 <Dialog open={!!post} onOpenChange={open=>{if(!open)setPost(null);}}><DialogContent className="post-dialog" onBackdropClick={()=>setPost(null)}><DialogHeader><DialogTitle>Staging post</DialogTitle><DialogDescription>Current retained record | HK pipeline</DialogDescription></DialogHeader>{post&&<><CopyCode label="POST ID" value={post.post_id}/><div className="inspector-tabs"><Button variant={tab==="summary"?"secondary":"ghost"} onClick={()=>setTab("summary")}>Details</Button><Button variant={tab==="caption"?"secondary":"ghost"} onClick={()=>setTab("caption")}>Full caption</Button></div><PopupTransition key={tab}>{tab==="summary"?<dl className="post-facts">{[["User ID",post.user_id||"Not recorded"],["Embedding",post.jobs?.embed?.status||"Unknown"],["Publication",post.publish_status||"Unknown"],["Attempts",post.jobs?.embed?.attempts||0],["Model",post.embedding_model||"Not recorded"],["Synced",date(post.synced_at)],["Published",date(post.published_at)],["Failure / skip reason",post.jobs?.embed?.error_type||post.jobs?.embed?.reason||"None recorded"]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>:<CaptionContent caption={post.caption||""}/>}</PopupTransition></>}</DialogContent></Dialog></Card>;
}
