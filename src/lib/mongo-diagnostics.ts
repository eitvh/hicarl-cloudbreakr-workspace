export class MongoConfigurationError extends Error {
 readonly fields:string[];
 constructor(fields:string[]){super('MongoDB configuration is incomplete');this.name='MongoConfigurationError';this.fields=fields;}
}
export function assertMongoConfiguration(env:Record<string,string|undefined>):asserts env is Record<string,string|undefined>&{AUTOMATION_IG_MONGO_URI:string;AUTOMATION_IG_MONGO_DATABASE:string}{
 const missing=['AUTOMATION_IG_MONGO_URI','AUTOMATION_IG_MONGO_DATABASE'].filter(key=>!env[key]?.trim());
 if(missing.length)throw new MongoConfigurationError(missing);
 if(!/^mongodb(?:\+srv)?:\/\//.test(env.AUTOMATION_IG_MONGO_URI!))throw new MongoConfigurationError(['AUTOMATION_IG_MONGO_URI (invalid format; remove surrounding quotes)']);
}
export function mongoFailure(error:unknown){
 const e=error as {name?:string;code?:number|string;message?:string;cause?:{code?:number|string;name?:string}};
 if(error instanceof MongoConfigurationError)return {code:'MONGO_CONFIG',hint:'Set these Vercel Production variables and redeploy: '+error.fields.join(', ')};
 if(e?.code===18)return {code:'MONGO_AUTH',hint:'MongoDB rejected authentication. Check the Production database user, password encoding, and authSource.'};
 if(e?.code===13)return {code:'MONGO_PERMISSION',hint:'The MongoDB user lacks read permission on a configured database or collection.'};
 if(e?.code===50||e?.name==='MongoOperationTimeoutError')return {code:'MONGO_QUERY_TIMEOUT',hint:'A MongoDB query exceeded its time limit. Check Atlas query performance and existing indexes.'};
 if(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED/.test(String(e?.code||e?.cause?.code||'')))return {code:'MONGO_NETWORK',hint:'MongoDB DNS or network connection failed. Check the Production URI, cluster availability, and Atlas network access for Vercel.'};
 if(/ServerSelection|Network/.test(e?.name||''))return {code:'MONGO_CONNECTION_TIMEOUT',hint:'Vercel could not reach an eligible MongoDB server. Check Atlas IP access rules for Vercel egress, cluster availability, and TLS/DNS. A local connection does not establish Vercel access.'};
 if(/Parse|InvalidArgument/.test(e?.name||''))return {code:'MONGO_CONFIG',hint:'Check MongoDB URI syntax and database names in Vercel Production variables.'};
 return {code:'MONITORING_READ_FAILED',hint:'Monitoring data could not be read. Use the diagnostic reference in Vercel runtime logs.'};
}
