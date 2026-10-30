// Offline HTTP doubles only; database retention/RLS/Storage guarantees are validated separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTenbotReceivalCleanupHandler} from '../supabase/functions/_shared/tenbot-receival-cleanup';
const secret='offline-maintenance-service-key-placeholder',owner='a0000000-0000-4000-8000-000000000001',id='b0000000-0000-4000-8000-000000000002';
const row={id,storageBucket:'invoice-receival-originals',storagePath:owner+'/'+id+'/original'};
const groups:string[]=[];
async function test(name:string,run:()=>Promise<void>){await run();groups.push(name);}
function fixture(options:{enabled?:boolean;key?:string;rows?:unknown;rpcError?:boolean;removeError?:boolean;finishError?:boolean}={}){
 const calls:{name:string;args:Record<string,unknown>}[]=[],removed:string[][]=[];
 const handler=createTenbotReceivalCleanupHandler({enabled:options.enabled??true,serviceRoleKey:options.key??secret,
  rpc:async(name,args)=>{calls.push({name,args});return {data:name==='claim_expired_invoice_receival_sources'?(options.rows??[row]):null,error:options.rpcError||options.finishError&&name==='finish_expired_invoice_receival_source_removal'?{message:'private internal detail'}:null};},
  remove:async(paths)=>{removed.push(paths);return {error:options.removeError?'private storage detail':null};}});
 const send=(body:unknown={},headers:Record<string,string>={},method='POST')=>handler(new Request('https://local.invalid/cleanup',{method,headers:{authorization:'Bearer '+secret,'content-type':'application/json',...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}));
 return {handler,send,calls,removed};
}
await test('only exact service Bearer and POST; no public CORS',async()=>{
 const f=fixture();for(const value of ['', 'Bearer employee-jwt','bearer '+secret,'Bearer '+secret+'x'])assert.equal((await f.send({},{authorization:value})).status,401);
 assert.equal((await f.send({}, {},'GET')).status,405);const options=await f.send({}, {},'OPTIONS');assert.equal(options.status,405);assert.equal(options.headers.get('access-control-allow-origin'),null);
 assert.equal(f.calls.length,0);assert.equal((await fixture({key:''}).send()).status,401);
});
await test('default-off does not touch metadata or Storage',async()=>{
 const f=fixture({enabled:false});const result=await f.send();assert.equal(result.status,503);assert.equal(f.calls.length,0);assert.equal(f.removed.length,0);
 const entry=readFileSync('supabase/functions/tenbot-receival-cleanup/index.ts','utf8');assert.match(entry,/TENBOT_RECEIVAL_CLEANUP_ENABLED'\)==='true'/);assert.match(entry,/AbortSignal\.timeout\(15000\)/);assert.match(entry,/@supabase\/supabase-js@2\.101\.1/);
 assert.doesNotMatch(entry,/getUser|\.download\(|\.from\(['"](?:pending_receivals|vendor_catalog|jobs)/);
});
await test('strict bounded JSON accepts no IDs, paths or arbitrary deletion target',async()=>{
 const f=fixture();for(const body of ['invalid','null','[]','', {limit:0},{limit:21},{limit:1.5},{limit:'1'},{limit:null},{sourceId:id},{paths:[row.storagePath]},{bucket:row.storageBucket},{state:'retained'}])assert.equal((await f.send(body)).status,400);
 assert.equal((await f.send({}, {'content-type':'text/plain'})).status,415);assert.equal((await f.send(' '.repeat(1025),{'content-length':'1'})).status,413);
 assert.equal(f.calls.length,0);assert.equal(f.removed.length,0);
});
await test('default and explicit limits delegate claim/delete/finalize; response contains counts only',async()=>{
 const f=fixture();const result=await f.send({limit:1});assert.equal(result.status,200);assert.deepEqual(await result.json(),{removedCount:1});assert.equal(result.headers.get('cache-control'),'no-store');
 assert.deepEqual(f.calls,[{name:'claim_expired_invoice_receival_sources',args:{p_limit:1}},{name:'finish_expired_invoice_receival_source_removal',args:{p_source_id:id}}]);assert.deepEqual(f.removed,[[row.storagePath]]);
 const empty=fixture({rows:[]});assert.deepEqual(await (await empty.send()).json(),{removedCount:0});assert.deepEqual(empty.calls[0].args,{p_limit:20});
});
await test('malformed metadata, other buckets, arbitrary paths and duplicate claims fail before deletion',async()=>{
 for(const rows of [[{...row,storageBucket:'other'}],[{...row,storagePath:'../'+id+'/original'}],[{...row,storagePath:owner+'/'+id+'/another'}],[{...row,id:'invalid'}],[row,row],{},Array(21).fill(row)]){
  const f=fixture({rows});const result=await f.send();assert.equal(result.status,503);assert.deepEqual(await result.json(),{error:'cleanup_incomplete'});assert.equal(f.removed.length,0);assert.equal(f.calls.length,1);
 }
});
await test('failure is sanitized and deletion failure cannot finalize metadata',async()=>{
 for(const option of [{rpcError:true},{removeError:true},{finishError:true}]){const f=fixture(option),result=await f.send();assert.equal(result.status,503);assert.deepEqual(await result.json(),{error:'cleanup_incomplete'});if(!option.finishError)assert.equal(f.calls.length,1);}
});
console.log(JSON.stringify({mode:'offline-http-only',groupsPassed:groups.length,groups},null,2));
