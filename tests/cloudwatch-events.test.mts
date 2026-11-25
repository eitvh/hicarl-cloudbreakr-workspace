import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCloudWatchCsv,invocationEvents} from '../src/features/monitoring/lib/cloudwatch-events.ts';
test('CSV handles multiline JSON and doubled quotes',()=>{const events=parseCloudWatchCsv('timestamp,message\n1795000000000,"line 1\n{""run_id"":""abc""}"\n');assert.equal(events.length,1);assert.equal(events[0].message,'line 1\n{"run_id":"abc"}');});
test('associates only unambiguous active request events',()=>{const events=['START RequestId: a','app a','START RequestId: b','ambiguous','END RequestId: b','app a again','END RequestId: a','REPORT RequestId: a','outside'].map((message,timestamp)=>({message,timestamp}));assert.deepEqual(invocationEvents(events,'a').map(e=>e.message),['START RequestId: a','app a','app a again','END RequestId: a','REPORT RequestId: a']);});
