import type {DashboardData,Run,ApiTotals} from './dashboard';
export type DailyGroup={_id:{key:unknown;day?:string};[key:string]:unknown};
export function mergeDailyGroups(rows:DailyGroup[],date:string):Record<string,unknown>[] {
 const merged=new Map<string,Record<string,unknown>>();
 for(const row of rows){if(date!=='all'&&row._id.day!==date)continue;const key=JSON.stringify(row._id.key);const target=merged.get(key)||{_id:row._id.key};for(const [field,value] of Object.entries(row)){if(field!=='_id'&&typeof value==='number')target[field]=Number(target[field]||0)+value;}merged.set(key,target);}
 return [...merged.values()];
}
export type ReportRun={_id:string;stage:string;status:string;locationId?:number;reporting_date_my?:string};
type Event=ApiTotals & {_id:{run_id:string;type:string;metric:string;operation:string;outcome:string}};
export function buildActivityReport(rows:DailyGroup[],runDocs:ReportRun[],date:string):DashboardData['report']{
 const events=mergeDailyGroups(rows,date) as unknown as Event[];
 const eventRuns=new Set(events.map(e=>e._id.run_id));
 const runs:Run[]=runDocs.filter(r=>date==='all'||r.reporting_date_my===date||eventRuns.has(r._id)).map(r=>({run_id:r._id,stage:r.stage,status:r.status,locationId:r.locationId??null,counts:{},api:{}}));
 const map=new Map(runs.map(r=>[r.run_id,r]));
 const totals={counts:{} as Record<string,number>,estimated_usd:0,unknown_cost_calls:0,input_tokens:0,output_tokens:0};
 for(const event of events){let run=map.get(event._id.run_id);if(!run){run={run_id:event._id.run_id,stage:'unknown',status:'unknown',locationId:null,counts:{},api:{}};runs.push(run);map.set(run.run_id,run);}
  if(event._id.type==='post_count'){run.counts[event._id.metric]=(run.counts[event._id.metric]||0)+event.count;totals.counts[event._id.metric]=(totals.counts[event._id.metric]||0)+event.count;}
  else{const values={count:event.count,input_tokens:event.input_tokens,output_tokens:event.output_tokens,estimated_usd:event.estimated_usd,unknown_cost_calls:event.unknown_cost_calls};(run.api[event._id.operation]??={})[event._id.outcome]=values;totals.estimated_usd+=values.estimated_usd;totals.unknown_cost_calls+=values.unknown_cost_calls;totals.input_tokens+=values.input_tokens;totals.output_tokens+=values.output_tokens;}
 }
 return {reporting_date_my:date,run_count:runs.length,totals,runs};
}
export function selectSnapshotDate(data:DashboardData,date:string):DashboardData|null{
 const selected=data.dailyReports?.[date];
 if(!selected)return null;
 return {...data,...selected,date,apiDetails:{},posts:[],page:1,postCount:0};
}
