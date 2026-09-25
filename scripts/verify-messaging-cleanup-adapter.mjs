import assert from 'node:assert/strict';
import {createHandler,sameSecret} from '../supabase/functions/cleanup-messaging-drafts/core.mjs';
const secret='local-fixture-secret-'.repeat(3),id='20000000-0000-0000-0000-000000000001';
assert(await sameSecret(secret,secret));assert(!await sameSecret('wrong',secret));
function fixture(drafts=[{message_id:id,paths:[`${id}/a/file`,`${id}/b/file`]}]){
 const calls=[],logs=[],records=[];let fail=false,claimFail=false,failAt=Infinity,removals=0,delay=0;
 const client={from:table=>{assert.equal(table,'messaging_cleanup_runs');return{upsert:async row=>{records.push(row);return{error:null};},update:row=>({eq:async()=>{records.push(row);return{error:null};}})}},rpc:async(name,args)=>{calls.push([name,args]);if(delay)await new Promise(r=>setTimeout(r,delay));return name==='claim_abandoned_my_work_transfers'?{data:drafts,error:claimFail?{}:null}:{error:null};},storage:{from:bucket=>{assert.equal(bucket,'my-work-inbox-attachments');return{remove:async paths=>{calls.push(['remove',paths]);return{error:(fail||++removals===failAt)?{}:null};}}}}};
 const handler=createHandler({secret,clientFactory:()=>client,log:x=>logs.push(JSON.parse(x))});
 const request=(key=secret,method='POST')=>handler(new Request('http://local.invalid',{method,headers:{'x-messaging-cleanup-secret':key},...(method==='POST'?{body:JSON.stringify({paths:['unrelated/object'],bucket:'unrelated'})}:{})}));
 return{request,calls,logs,records,set fail(v){fail=v;},set claimFail(v){claimFail=v;},set failAt(v){failAt=v;},set delay(v){delay=v;},client};
}
let f=fixture();assert.equal((await f.request('')).status,401);assert.equal((await f.request('wrong')).status,401);assert.equal((await f.request(secret,'GET')).status,405);assert.equal(f.calls.length,0);
assert.equal((await f.request()).status,200);assert.deepEqual(f.calls[0],['claim_abandoned_my_work_transfers',{p_limit:50}]);assert.deepEqual(f.calls[1],['remove',[`${id}/a/file`,`${id}/b/file`]]);assert.equal(f.logs[0].cleaned,1);assert(!JSON.stringify(f.logs).includes('/file'));
f=fixture();f.fail=true;assert.equal((await f.request()).status,503);assert(!f.calls.some(([n])=>n==='finish_abandoned_my_work_transfer'));f.fail=false;assert.equal((await f.request()).status,200);assert.equal((await f.request()).status,200);
f=fixture([{message_id:id,paths:['unrelated/file']}]);assert.equal((await f.request()).status,503);assert(!f.calls.some(([n])=>n==='remove'));
f=fixture(Array(51).fill({message_id:id,paths:[]}));assert.equal((await f.request()).status,503);assert(!f.calls.some(([n])=>n==='remove'));
f=fixture();f.claimFail=true;assert.equal((await f.request()).status,503);
console.log('PASS: adapter authentication, fixed scope/batch, safe logs, delete failure blocks finish, retry/duplicate, claim failure.');

f=fixture([{message_id:id,paths:Array.from({length:101},(_,i)=>`${id}/${i}/file`)}]);f.failAt=2;
assert.equal((await f.request()).status,503);assert(!f.calls.some(([n])=>n==='finish_abandoned_my_work_transfer'));
assert.equal(f.calls.filter(([n])=>n==='remove')[0][1].length,100);
assert.equal((await f.request()).status,200);
f=fixture();f.delay=25;
const timeout=createHandler({secret,clientFactory:()=>f.client,deadlineMs:5,log:()=>{}});
const timed=await timeout(new Request('http://local.invalid',{method:'POST',headers:{'x-messaging-cleanup-secret':secret}}));
assert.equal(timed.status,503);assert(!f.calls.some(([n])=>n==='remove'));
console.log('PASS: partial second-batch failure retains draft; retry reconciles; deadline stops deletion.');
