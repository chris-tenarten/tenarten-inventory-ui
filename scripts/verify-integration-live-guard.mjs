import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
const origin='http://localhost:3356',checks=[];
for(const path of ['/rest/v1/jobs','/rest/v1/manpower_entries','/rest/v1/rpc/ensure_my_welcome_notification','/rest/v1/rpc/mark_my_work_inbox_conversation_read','/rest/v1/rpc/send_my_work_inbox_message','/rest/v1/rpc/unknown_mutation','/rest/v1/rpc/get_sneaky_write','/rest/v1/rpc/get_sample_formulation_default','/storage/v1/object/file','/functions/v1/generate-sample-pdf','/realtime/v1/api/broadcast','/api/delete-transaction','/auth/v1/signup']){
 for(const method of path==='/rest/v1/jobs'?['POST','PATCH','DELETE']:['POST']){
  const r=await fetch(origin+path,{method,headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,403,path);checks.push({path,method,status:r.status});
 }
}
for(const path of ['/rest/v1/rpc/ensure_my_welcome_notification','/rest/v1/rpc/send_my_work_inbox_message','/rest/v1/rpc/%67et_my_app_access','/functions/v1/generate-sample-pdf','/api/delete-transaction']){const r=await fetch(origin+path);assert.equal(r.status,403,path);checks.push({path,method:'GET',status:r.status});}
const page=await fetch(origin+'/');assert(page.headers.get('content-security-policy').includes("worker-src 'none'"));assert(page.headers.get('content-security-policy').includes("frame-src 'none'"));
const state=await(await fetch(origin+'/__review/state')).json();assert.equal(state.mode,'hosted-read-only');assert(state.calls.every(c=>c.blocked&&!c.forwardMethod));
mkdirSync('docs/project-memory/evidence',{recursive:true});writeFileSync('docs/project-memory/evidence/2026-10-19-integration-live-guard.json',JSON.stringify({checks,passed:checks.length,upstreamForwards:0,businessWrites:0,csp:'original fail-closed worker/frame policy retained',note:'All probes were rejected locally before upstream. Existing unit verifier separately checks authorized RPCs convert to GET.'},null,2));console.log('PASS '+checks.length+' forbidden live requests blocked before upstream; original hosted-review CSP retained');
