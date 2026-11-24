"use client";
import type {DashboardData} from '@/lib/dashboard';
import {Card} from '@/components/ui/card';
import {InfoTip} from '@/components/info-tip';
export function DateOverview({data}:{data:DashboardData}){
 const counts=data.report.totals.counts;
 const rows=[['Fetched',counts.synced||0],['Embedding completed',counts.embedding_completed||0],['Embedding skipped',counts.embedding_skipped||0],['Embedding failed',counts.embedding_failed||0],['Extraction completed',counts.extraction_completed||0],['Extraction failed',counts.extraction_failed||0],['Published',counts.published||0]] as const;
 const max=Math.max(1,...rows.map(r=>r[1]));
 const api=data.report.runs.flatMap(r=>Object.values(r.api).flatMap(o=>Object.entries(o)));
 const success=api.filter(([key])=>key==='api_succeeded').reduce((n,[,v])=>n+v.count,0),failed=api.filter(([key])=>key==='api_failed').reduce((n,[,v])=>n+v.count,0);
 const retained=data.groups.reduce((n,g)=>n+g.count,0);
 return <div className="date-overview"><Card className="dash-panel"><h2>{data.date==='all'?'All activity dates':data.date} | Job activity <InfoTip text="Events for the selected source job and activity dates. Retries can count a post again. This is not a historical snapshot of staging status."/></h2><div className="event-bars">{rows.map(([label,value])=><div key={label}><span>{label}</span><div className="bar-track"><div style={{width:value/max*100+'%'}}/></div><strong>{value.toLocaleString()}</strong></div>)}</div></Card><Card className="dash-panel"><h2>Report summary</h2><div className="date-overview-summary">{[['Contributing executions',data.report.run_count.toLocaleString()],['API succeeded',success.toLocaleString()],['API failed',failed.toLocaleString()],['API success rate',success+failed?(success/(success+failed)*100).toFixed(2)+'%':'Not recorded'],['Input tokens',data.report.totals.input_tokens.toLocaleString()],['Output tokens',data.report.totals.output_tokens.toLocaleString()]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="manual-scope-note"><span>Current staging</span><p>{retained.toLocaleString()} retained posts. This is the current collection state, independent of the activity date. Open Staging post to browse records.</p></div></Card></div>;
}
