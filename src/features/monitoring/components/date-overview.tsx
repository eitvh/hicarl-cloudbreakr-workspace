"use client";
import type {DashboardData} from '@/features/monitoring/server/dashboard';
import {Card} from '@/components/ui/card';
import {InfoTip} from '@/components/info-tip';
import {Database,Layers,ScanText,Send,Check, X, Cpu, ArrowDownToLine, ArrowUpFromLine} from 'lucide-react';
export function DateOverview({data}:{data:DashboardData}){
 const counts=data.report.totals.counts;
 const n=(value:number)=>value.toLocaleString();
 const api=data.report.runs.flatMap(r=>Object.values(r.api).flatMap(o=>Object.entries(o)));
 const success=api.filter(([key])=>key==='api_succeeded').reduce((sum,[,v])=>sum+v.count,0);
 const failed=api.filter(([key])=>key==='api_failed').reduce((sum,[,v])=>sum+v.count,0);
 const total=success+failed,rate=total?success/total*100:0;
 const retained=data.groups.reduce((sum,g)=>sum+g.count,0);
 const stages=[
  {name:'Fetch posts',icon:Database,value:counts.synced||0,label:'Fetched events',details:[['Executions',data.report.run_count]]},
  {name:'Embeddings',icon:Layers,value:counts.embedding_completed||0,label:'Completed events',details:[['Skipped',counts.embedding_skipped||0],['Failed',counts.embedding_failed||0]]},
  {name:'Extraction',icon:ScanText,value:counts.extraction_completed||0,label:'Completed events',details:[['Skipped',counts.extraction_skipped||0],['Failed',counts.extraction_failed||0]]},
  {name:'Publication',icon:Send,value:counts.published||0,label:'Published events',details:[]},
 ];
 return <div className="date-overview">
  <Card className="dash-panel activity-stage-panel">
   <div className="activity-panel-heading"><h2>Processing activity <InfoTip text="Processing events for the selected job and activity dates. Retries can count the same post more than once. Stage totals are event counts, not completion percentages."/></h2><span>{data.date==='all'?'All activity dates':data.date}</span></div>
   <div className="activity-stage-grid">{stages.map((stage,index)=><div className="activity-stage-card" key={stage.name}>
    <div className="activity-stage-heading"><stage.icon size={16}/><h3>{stage.name}</h3><span>0{index+1}</span></div>
    <div className="activity-stage-value"><strong>{n(stage.value)}</strong><span>{stage.label}</span></div>
    <div className="activity-stage-details">{stage.details.map(([label,value])=><div key={label}><span>{label}</span><strong className={label==='Failed'&&Number(value)>0?'activity-error':undefined}>{n(Number(value))}</strong></div>)}</div>
   </div>)}</div>
  </Card>
  <Card className="dash-panel activity-health-panel">
   <h2>API &amp; execution summary <InfoTip text="API success rate uses succeeded and failed calls only. Started or unfinished calls are excluded. API results and processing events are separate measures."/></h2>
   <div className="health-summary-body">
    <div className="health-outcomes">
     <div className="health-ring" role="img" aria-label={total?'API success rate '+rate.toFixed(2)+' percent':'No completed API calls recorded'}>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="health-ring-track" cx="60" cy="60" r="52"/>{total>0&&<><circle className="health-ring-failed" cx="60" cy="60" r="52"/><circle className="health-ring-success" cx="60" cy="60" r="52" pathLength="100" strokeDasharray={rate+' 100'} transform="rotate(-90 60 60)"/></>}</svg>
      <div><strong>{total?rate.toFixed(2)+'%':'?'}</strong><span>API success rate</span></div>
     </div>
     <div className="health-outcome-cards">
      <div className="health-outcome success"><span className="health-outcome-icon"><Check size={15}/></span><div><span>Succeeded</span><strong>{n(success)}</strong></div><small>{total?rate.toFixed(2)+'%':'?'}</small></div>
      <div className="health-outcome failed"><span className="health-outcome-icon"><X size={15}/></span><div><span>Failed</span><strong>{n(failed)}</strong></div><small>{total?(100-rate).toFixed(2)+'%':'?'}</small></div>
      <p>{n(total)} completed API calls</p>
     </div>
    </div>
    <div className="health-metric-grid">
     {[{label:'Executions',value:data.report.run_count,icon:Cpu},{label:'Input tokens',value:data.report.totals.input_tokens,icon:ArrowDownToLine},{label:'Output tokens',value:data.report.totals.output_tokens,icon:ArrowUpFromLine}].map(metric=><div key={metric.label}><span><metric.icon size={14}/>{metric.label}</span><strong>{n(metric.value)}</strong></div>)}
    </div>
   </div>
   <div className="activity-staging-note"><div><span>Current staging</span><strong>{n(retained)} <small>retained posts</small></strong></div><InfoTip text="Current posts retained for this location. This collection state is independent of the selected activity date. Open Staging post to browse individual records."/></div>
  </Card>
 </div>;
}
