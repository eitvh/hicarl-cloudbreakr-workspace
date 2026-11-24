import assert from "node:assert/strict";
import { test } from "node:test";
import {parseFargateCsv,summarizeFargate,fargateUsage} from "../src/lib/fargate-usage.ts";
test("CSV handles quoted multiline messages and overlapping exports",()=>{
 const csv='timestamp,message,logStream\n1795500000000,"hello, ""world""\nnext line",ecs/pipeline/a\n1795500120000,end,ecs/pipeline/a';
 const events=parseFargateCsv(csv);
 assert.equal(events[0].message,'hello, "world"\nnext line');
 const result=summarizeFargate([...events,...events]);
 assert.equal(result.duplicates,2);assert.equal(result.seconds,120);
 assert.equal(fargateUsage(result.tasks,2,4,20).cpuHours,240/3600);
});
test("separate task streams sum independently with per-task minimum",()=>{
 const result=summarizeFargate(parseFargateCsv('@timestamp,@message,@logStream\n2026-11-24 00:00:00,start,a\n2026-11-24 00:02:00,end,a\n2026-11-24T00:00:00Z,only,b'));
 assert.equal(result.tasks.length,2);
 const usage=fargateUsage(result.tasks,2,4,21);
 assert.equal(usage.seconds,180);assert.equal(usage.storageHours,.05);
});
test("unknown streams merge split files and flag assumption",()=>{
 const result=summarizeFargate([...parseFargateCsv('timestamp,message\n1795500000000,start'),...parseFargateCsv('timestamp,message\n1795500120000,end')]);
 assert.equal(result.unidentified,true);assert.equal(result.tasks.length,1);assert.equal(result.seconds,120);
});
test("reject malformed, wrong-source or invalid inputs",()=>{
 for(const csv of ['foo,bar\na,b','timestamp,message\nbad,x','timestamp,message\n1795500000000,"oops','timestamp,message\n1795500000000,REPORT RequestId: abc']) assert.throws(()=>parseFargateCsv(csv));
 assert.throws(()=>fargateUsage([],0,4,20));assert.throws(()=>fargateUsage([],2,4,19));
});
test("ECS lifecycle rounds up billing seconds and uses allocated resources",()=>{
 const start=Date.parse("2026-11-24T07:01:21.723Z");
 const end=Date.parse("2026-11-24T08:03:46.720Z");
 const seconds=(end-start)/1000;
 assert.equal(seconds,3744.997);
 const usage=fargateUsage([{stream:"ecs-task",start,end,seconds,events:0}],2,4,20);
 assert.equal(usage.seconds,3745);
 assert.equal(usage.cpuHours,7490/3600);
 assert.equal(usage.memoryHours,14980/3600);
 assert.equal(usage.storageHours,0);
});
