import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildActivityReport,mergeDailyGroups,selectSnapshotDate,type DailyGroup} from '../src/lib/report-selection.ts';
import type {DashboardData} from '../src/lib/dashboard.ts';
const totals={count:1,input_tokens:10,output_tokens:0,estimated_usd:0.1,unknown_cost_calls:0};
const rows:DailyGroup[]=[
 {_id:{key:{run_id:'r1',type:'post_count',metric:'published'},day:'2026-11-21'},...totals,count:5},
 {_id:{key:{run_id:'r1',type:'post_count',metric:'published'},day:'2026-11-22'},...totals,count:3},
 {_id:{key:{run_id:'r1',type:'api_usage',operation:'embedding',outcome:'api_succeeded'},day:'2026-11-21'},...totals},
 {_id:{key:{run_id:'r1',type:'api_usage',operation:'embedding',outcome:'api_succeeded'},day:'2026-11-22'},...totals,input_tokens:20,estimated_usd:0.2},
 {_id:{key:{run_id:'r1',type:'api_usage',operation:'embedding',outcome:'api_failed'},day:'2026-11-22'},...totals,input_tokens:0,estimated_usd:0,unknown_cost_calls:1}
];
const runs=[{_id:'r1',stage:'ingest',status:'completed',reporting_date_my:'2026-11-21',locationId:1},{_id:'r2',stage:'ingest',status:'failed',reporting_date_my:'2026-11-20'}];
test('daily report includes cross-midnight runs, but only that day events and costs',()=>{
 const d=buildActivityReport(rows,runs,'2026-11-22');assert.equal(d.run_count,1);assert.equal(d.totals.counts.published,3);assert.equal(d.totals.input_tokens,20);assert.equal(d.totals.estimated_usd,0.2);assert.equal(d.totals.unknown_cost_calls,1);assert.equal(d.runs[0].status,'completed');
});
test('all-date report combines events and API outcomes without losing earlier days',()=>{
 const d=buildActivityReport(rows,runs,'all');assert.equal(d.run_count,2);assert.equal(d.totals.counts.published,8);assert.equal(d.totals.input_tokens,30);assert.equal(d.runs[0].api.embedding.api_succeeded.count,2);assert.equal(d.runs[0].api.embedding.api_failed.count,1);assert.equal(d.totals.unknown_cost_calls,1);
});
test('a day with no activity returns zero totals, not all-date totals',()=>{
 const d=buildActivityReport(rows,runs,'2026-11-23');assert.equal(d.run_count,0);assert.deepEqual(d.totals.counts,{});assert.equal(d.totals.estimated_usd,0);
});
test('selecting a cached day updates report/cost scope without mutating original snapshot',()=>{
 const report=buildActivityReport(rows,runs,'2026-11-22');const data={date:'all',report:buildActivityReport(rows,runs,'all'),dailyReports:{'2026-11-22':{report,costs:[],extraction:[]}},posts:[{post_id:'old'}],apiDetails:{api_failed:[{}]},page:4,postCount:9} as unknown as DashboardData;
 const selected=selectSnapshotDate(data,'2026-11-22')!;assert.equal(selected.date,'2026-11-22');assert.equal(selected.report.totals.counts.published,3);assert.deepEqual(selected.posts,[]);assert.deepEqual(selected.apiDetails,{});assert.equal(data.date,'all');assert.equal(data.page,4);assert.equal(selectSnapshotDate(data,'unknown'),null);
});
test('daily merge preserves pricing groups and does not modify inputs',()=>{
 const before=JSON.stringify(rows);const merged=mergeDailyGroups(rows,'all');assert.equal(merged.length,3);assert.equal(JSON.stringify(rows),before);
});
