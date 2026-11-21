import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession,validSession,credentialsMatch,SESSION_SECONDS} from '../src/lib/auth.ts';
process.env.DASHBOARD_SESSION_SECRET='test-only-secret-not-for-deployment';
process.env.DASHBOARD_USERNAME='admin';process.env.DASHBOARD_PASSWORD='123456';
test('login requires the correct username and password',()=>{assert.equal(credentialsMatch('admin','123456'),true);assert.equal(credentialsMatch('other','123456'),false);assert.equal(credentialsMatch('admin','incorrect'),false);});
test('signed sessions reject tampering and expiration',()=>{const now=1700000000000,token=createSession(now);assert.equal(validSession(token,now),true);assert.equal(validSession(token+'x',now),false);assert.equal(validSession(token,now+SESSION_SECONDS*1000),false);assert.equal(validSession(undefined,now),false);const payload=Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+99999})).toString('base64url');assert.equal(validSession(payload+'.'+token.split('.')[1],now),false);});
test('changing credentials invalidates sessions',()=>{const token=createSession();process.env.DASHBOARD_PASSWORD='changed';assert.equal(validSession(token),false);process.env.DASHBOARD_PASSWORD='123456';});
