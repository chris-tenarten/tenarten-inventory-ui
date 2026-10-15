import assert from 'node:assert/strict';
import {PREFIX,SAFE_RPCS,SAFE_TABLES,CSP,planRequest,forwardHeaders} from './support/read-only-review-guard.mjs';
const path=p=>PREFIX+p;
assert.equal(planRequest(path('/auth/v1/token?grant_type=password'),'POST',{email:'normal@example.invalid',password:'not-real'}).kind,'auth');
assert.equal(planRequest(path('/auth/v1/token?grant_type=refresh_token'),'POST',{refresh_token:'not-real'}).kind,'auth');
assert.equal(planRequest(path('/auth/v1/user'),'GET').kind,'auth');
for(const endpoint of ['/auth/v1/signup','/auth/v1/recover','/auth/v1/admin/users','/auth/v1/user','/auth/v1/token?grant_type=other'])assert.equal(planRequest(path(endpoint),'POST',{}),null);
for(const rpc of SAFE_RPCS){const plan=planRequest(path('/rest/v1/rpc/'+rpc),'POST',{});assert.equal(plan.kind,'read');assert.equal(plan.method,'GET');}
for(const rpc of ['ensure_my_welcome_notification','mark_my_work_inbox_conversation_read','send_my_work_inbox_message','unknown_mutation','get_sneaky_write','recover_my_work_attachment_transfer','set_my_account_preference'])for(const method of ['POST','GET','HEAD'])assert.equal(planRequest(path('/rest/v1/rpc/'+rpc),method,{}),null);
for(const table of SAFE_TABLES){assert.equal(planRequest(path('/rest/v1/'+table),'GET').kind,'read');for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(planRequest(path('/rest/v1/'+table),method,{}),null);}
for(const endpoint of ['/storage/v1/object/bucket/file','/storage/v1/upload/resumable','/functions/v1/generate-sample-pdf','/functions/v1/unknown','/realtime/v1/api/broadcast','/rest/v1/unknown','/rest/v1/rpc/%67et_my_app_access'])for(const method of ['POST','GET','DELETE'])assert.equal(planRequest(path(endpoint),method,{}),null);
assert.equal(planRequest('/api/delete-transaction','POST',{}),null);
const page=planRequest(path('/rest/v1/rpc/list_my_work_message_page_v11'),'POST',{p_peer:'00000000-0000-0000-0000-000000000001',p_ids:['00000000-0000-0000-0000-000000000002'],p_before_id:null});
assert.equal(page.method,'GET');assert(new URL(page.path,'http://local').searchParams.get('p_ids').startsWith('{'));assert.equal(new URL(page.path,'http://local').searchParams.has('p_before_id'),false);
const headers=forwardHeaders({'authorization':'Bearer caller','apikey':'privileged-forgery','content-profile':'private','accept-profile':'auth','x-http-method-override':'DELETE',prefer:'count=exact,tx=commit,return=representation'},'public-anon');
assert.deepEqual(headers,{apikey:'public-anon',authorization:'Bearer caller',prefer:'count=exact','accept-profile':'public'});
for(const directive of ["connect-src 'self' ws://localhost:3000","worker-src 'none'","form-action 'self'","frame-src 'none'"])assert(CSP.includes(directive));
console.log('PASS allowlisted login/refresh/user; explicit RPC/table reads; all business writes, welcome/read receipts/send/upload/Edge/Realtime/unknowns denied; GET read-only RPC conversion; header/schema overrides stripped; CSP bypass restrictions.');
