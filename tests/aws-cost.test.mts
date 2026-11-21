import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lambdaEstimate,queueEstimate,schedulerEstimate} from '../src/lib/aws-cost.ts';
test('partial Lambda sample cost uses configured GB-seconds plus per-request rate',()=>{
 const result=lambdaEstimate(106.144,136,'x86');assert.ok(Math.abs(result.total-0.0017962702048)<1e-12);assert.ok(lambdaEstimate(106.144,136,'arm').total<result.total);
});
test('SQS uses separate standard and FIFO billable request units',()=>{assert.ok(Math.abs(queueEstimate(1000000,1000000)-.9)<1e-12);});
test('Scheduler allowance applies only when explicitly supplied and cannot produce a negative charge',()=>{assert.equal(schedulerEstimate(1),.000001);assert.equal(schedulerEstimate(1,14000000),0);assert.equal(schedulerEstimate(20000000,14000000),6);});
test('invalid usage does not silently become zero cost',()=>{assert.throws(()=>lambdaEstimate(-1,1,'x86'));assert.throws(()=>queueEstimate(NaN,1));assert.throws(()=>schedulerEstimate(Infinity));});
