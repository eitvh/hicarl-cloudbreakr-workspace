import {test} from "node:test";
import assert from "node:assert/strict";
import {parseLambdaReports} from "../src/features/monitoring/lib/log-report.ts";
const line="REPORT RequestId: abc-123 Duration: 23.5 ms Billed Duration: 24 ms Memory Size: 1024 MB Max Memory Used: 96 MB";
test("parses billed memory separately from actual memory",()=>{assert.deepEqual(parseLambdaReports(line),[{requestId:"abc-123",durationMs:23.5,billedMs:24,memoryMb:1024,maxMemoryMb:96}]);});
test("accepts a CloudWatch events export",()=>{assert.equal(parseLambdaReports(JSON.stringify({events:[{message:line},{message:"START RequestId: abc-123"}]})).length,1);});
test("does not invent metrics for application messages or malformed reports",()=>{assert.equal(parseLambdaReports("error timeout REPORT RequestId: x").length,0);});
