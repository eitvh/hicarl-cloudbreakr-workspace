import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mongoFailure,assertMongoConfiguration} from '../src/lib/mongo-diagnostics.ts';
test('diagnostics do not expose raw credentials or database error messages',()=>{const result=mongoFailure({name:'MongoServerSelectionError',message:'mongodb://secret:password@private'});assert.equal(result.code,'MONGO_CONNECTION_TIMEOUT');assert.ok(!JSON.stringify(result).includes('password'));assert.equal(mongoFailure({code:18}).code,'MONGO_AUTH');assert.equal(mongoFailure({code:50}).code,'MONGO_QUERY_TIMEOUT');});
test('missing configuration names are actionable without values',()=>{assert.throws(()=>assertMongoConfiguration({}),e=>mongoFailure(e).code==='MONGO_CONFIG');});
