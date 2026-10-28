// Failure-only probes of the loopback adapter. No successful question is sent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {admin} from './support/intake-materials-database.mjs';
if(!process.argv.includes('--scripted-local'))throw Error('Use the explicit --scripted-local fixture gate.');
const directory='/private/tmp/tenops-tenbot-agent-poc',server=JSON.parse(readFileSync(directory+'/server.json','utf8'));
assert.equal(server.mode,'offline-scripted');assert.equal(server.spendingAuthorized,false);
for(const source of server.sourceHashes)assert.equal(createHash('sha256').update(readFileSync(source.path)).digest('hex'),source.sha256,'The adapter must load the exact reviewed source.');
const token=actor=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:actor})).toString('base64url')+'.local';
const endpoint='http://localhost:55595',origin='http://localhost:3000',checks=[];
async function probe(label,expected,{body={action:'ask',question:'Synthetic rejected HTTP probe'},authorization='Bearer '+token(admin),requestOrigin=origin,method='POST',raw}={}){
 const response=await fetch(endpoint,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},...(method==='GET'?{}:{body:raw??JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
 const value=await response.json();assert.equal(response.status,expected,label);assert.equal(typeof value.error,'string');assert(!JSON.stringify(value).includes('SYNTHETIC-PRIVATE-SENTINEL'));assert.equal(response.headers.get('cache-control'),'no-store');
 checks.push({label,status:response.status});
}
await probe('Missing local session denied',401,{authorization:''});
await probe('Different fixture actor denied',401,{authorization:'Bearer '+token('10282026-0000-4000-8000-000000000002')});
await probe('Non-local bearer rejected by synthetic fixture',401,{authorization:'Bearer not-a-local-token'});
await probe('Different localhost origin denied',403,{requestOrigin:'http://127.0.0.1:3000'});
await probe('Read endpoint has no execute action',400,{body:{action:'execute',confirmed:true}});
await probe('Browser cannot select paid provider',400,{body:{action:'ask',question:'Synthetic question',provider:'openai',spendingAuthorized:true}});
await probe('Caller-authored history rejected',400,{body:{action:'ask',question:'Synthetic question',history:[{answer:'SYNTHETIC-PRIVATE-SENTINEL'}]}});
await probe('Unknown conversation is opaque',403,{body:{action:'ask',question:'Synthetic question',conversationId:'10282026-0000-4000-8000-000000000999'}});
await probe('Malformed UUID rejected',400,{body:{action:'clear',conversationId:'invalid'}});
await probe('Whole HTTP body bounded',413,{raw:JSON.stringify({action:'ask',question:'X'.repeat(17000)})});
await probe('Unsupported HTTP method rejected',405,{method:'GET'});
const receipt={passed:true,at:new Date().toISOString(),checks,groups:checks.length,successfulQuestions:0,modelInferenceCalls:0,paidCalls:0,businessDatabaseWrites:0,authScope:'Unsigned existing synthetic local fixture only; no hosted Auth claim',sourceHashes:server.sourceHashes};
writeFileSync(directory+'/http.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify({passed:true,groups:checks.length,successfulQuestions:0,modelInferenceCalls:0}));
