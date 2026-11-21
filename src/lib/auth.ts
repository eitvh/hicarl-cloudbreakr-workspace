import { createHmac,createHash,timingSafeEqual,randomBytes } from "node:crypto";
export const SESSION_COOKIE="dashboard_session";
export const SESSION_SECONDS=8*60*60;
const developmentKey=randomBytes(32).toString('hex');
function equal(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function credentialsMatch(username:string,password:string){const expected=process.env.DASHBOARD_PASSWORD;return !!expected&&equal(username,process.env.DASHBOARD_USERNAME||'admin')&&equal(password,expected);}
function signingKey(){
 const secret=process.env.DASHBOARD_SESSION_SECRET||process.env.AUTOMATION_IG_MONGO_URI||(process.env.NODE_ENV!=='production'?developmentKey:'');
 if(!secret||!process.env.DASHBOARD_PASSWORD)throw new Error('Session configuration unavailable');
 return createHmac('sha256',secret).update('dashboard-session-v1|'+(process.env.DASHBOARD_USERNAME||'admin')+'|'+process.env.DASHBOARD_PASSWORD).digest();
}
export function createSession(now=Date.now()){
 const payload=Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+SESSION_SECONDS,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return payload+'.'+createHmac('sha256',signingKey()).update(payload).digest('base64url');
}
export function validSession(token:string|undefined,now=Date.now()){
 if(!token||token.length>1024)return false;
 try{const [payload,signature,extra]=token.split('.');if(extra||!payload||!signature)return false;const expected=createHmac('sha256',signingKey()).update(payload).digest('base64url');if(!equal(signature,expected))return false;const data=JSON.parse(Buffer.from(payload,'base64url').toString());return Number.isInteger(data.exp)&&data.exp>Math.floor(now/1000)&&data.exp<=Math.floor(now/1000)+SESSION_SECONDS;}catch{return false;}
}
