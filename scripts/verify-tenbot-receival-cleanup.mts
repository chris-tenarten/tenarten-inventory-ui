// Real local HMAC verification + HTTP/ledger doubles. No database/RLS/Storage proof.
import assert from 'node:assert/strict';
import {createHmac,randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createTenbotReceivalCleanupHandler,receivalCleanupWakeText,verifyReceivalCleanupWake,RECEIVAL_CLEANUP_PURPOSE,type ReceivalCleanupWake} from '../supabase/functions/_shared/tenbot-receival-cleanup';
const secret='synthetic-cleanup-signing-value-for-offline-tests-only',now=1793394000000;
const owner='a0000000-0000-4000-8000-000000000001',id='b0000000-0000-4000-8000-000000000002';
const row={id,storageBucket:'invoice-receival-originals',storagePath:owner+'/'+id+'/original'};
const groups:string[]=[];
async function test(name:string,run:()=>Promise<void>){await run();groups.push(name);}
function sign(change:Partial<ReceivalCleanupWake>={}):ReceivalCleanupWake{
 const wake={v:1 as const,purpose:RECEIVAL_CLEANUP_PURPOSE,run_id:randomUUID(),exp:Math.floor(now/1000)+60,limit:20,...change};
 return {...wake,sig:createHmac('sha256',secret).update(receivalCleanupWakeText(wake)).digest('hex')};
}
type Options={enabled?:boolean;key?:string;rows?:unknown;fail?:string;hook?:(name:string,signal:AbortSignal)=>void|Promise<void>};
function fixture(options:Options={}){
 const calls:{name:string;args:Record<string,unknown>}[]=[],removed:string[][]=[];
 const ledger=new Map<string,{wake:ReceivalCleanupWake;status:string}>();let control=true;
 const wake=sign();ledger.set(wake.run_id,{wake,status:'queued'});
 const rpc=async(name:string,args:Record<string,unknown>,signal:AbortSignal)=>{
  calls.push({name,args});await options.hook?.(name,signal);
  if(name==='consume_invoice_receival_cleanup_run'){
   const run=ledger.get(String(args.p_id)),accepted=control&&run?.status==='queued'&&run.wake.exp===args.p_exp&&run.wake.limit===args.p_limit;
   if(accepted)run!.status='running';
   return {data:accepted,error:options.fail==='consume'?{message:'private consume result uncertain'}:null};
  }
  if(name==='finish_invoice_receival_cleanup_run'){
   const run=ledger.get(String(args.p_id));if(run&&options.fail!=='run-finish')run.status=String(args.p_status);
   return {data:options.fail!=='run-finish',error:options.fail==='run-finish'?{message:'private status detail'}:null};
  }
  return {data:name==='claim_expired_invoice_receival_sources'?(options.rows??[row]):null,error:options.fail===name?{message:'private RPC detail'}:null};
 };
 const handler=createTenbotReceivalCleanupHandler({enabled:options.enabled??true,wakeSecret:options.key??secret,now:()=>now,rpc,
  remove:async(paths,signal)=>{removed.push(paths);await options.hook?.('remove',signal);return {error:options.fail==='remove'?'private Storage detail':null};}});
 function fresh(change:Partial<ReceivalCleanupWake>={}){const value=sign(change);ledger.set(value.run_id,{wake:value,status:'queued'});return value;}
 function send(body:unknown=wake,headers:Record<string,string>={},method='POST',signal?:AbortSignal){return handler(new Request('https://local.invalid/cleanup',{method,headers:{'content-type':'application/json',...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),signal}));}
 return {handler,send,calls,removed,wake,fresh,ledger,disable:()=>{control=false;}};
}
await test('Node HMAC and WebCrypto agree on exact fixed-purpose v1 payload',async()=>{
 const wake=sign({run_id:id});assert.equal(receivalCleanupWakeText(wake),`v1\ninvoice-original-expiry\n${id}\n${wake.exp}\n20`);
 assert.equal(await verifyReceivalCleanupWake(wake,secret,now),true);
 assert.equal(await verifyReceivalCleanupWake({...wake,sig:'0'.repeat(64)},secret,now),false);
 assert.equal(await verifyReceivalCleanupWake(wake,'a'.repeat(32),now),false);
 for(const change of [{exp:now/1000-1},{exp:now/1000+121},{limit:0},{limit:21},{purpose:'other'},{v:2},{run_id:'invalid'},{sig:wake.sig.toUpperCase()}])assert.equal(await verifyReceivalCleanupWake({...wake,...change},secret,now),false);
});
await test('default OFF, key misconfiguration and methods cannot invoke maintenance',async()=>{
 for(const options of [{enabled:false},{key:''},{key:'a'.repeat(31)},{key:'a'.repeat(257)},{key:'a'.repeat(40)+'\n'}]){const f=fixture(options);assert.equal((await f.send()).status,503);assert.equal(f.calls.length,0);}
 const f=fixture();assert.equal((await f.send(undefined,{},'GET')).status,405);const response=await f.send(undefined,{},'OPTIONS');assert.equal(response.status,405);assert.equal(response.headers.get('access-control-allow-origin'),null);assert.equal(f.calls.length,0);
});
await test('strict bounded body rejects arbitrary targets and invalid signatures before RPC',async()=>{
 const f=fixture();for(const body of ['invalid','null','[]','', {...f.wake,paths:[row.storagePath]},{...f.wake,bucket:row.storageBucket},{...f.wake,limit:1.5},{...f.wake,limit:'1'}])assert.equal((await f.send(body)).status,400);
 assert.equal((await f.send(undefined,{'content-type':'text/plain'})).status,415);
 assert.equal((await f.send(' '.repeat(1025),{'content-length':'1'})).status,413);
 assert.equal((await f.send(f.wake,{'content-length':'1025'})).status,413);
 for(const body of [{...f.wake,sig:'0'.repeat(64)},sign({exp:now/1000-1}),sign({exp:now/1000+121})])assert.equal((await f.send(body)).status,401);
 assert.equal(f.calls.length,0);assert.equal(f.removed.length,0);
});
await test('streamed body timeout and cancellation are bounded before consumption',async()=>{
 const f=fixture(),start=Date.now();
 const hung=new Request('https://local.invalid/cleanup',{method:'POST',headers:{'content-type':'application/json'},body:new ReadableStream({start(){}}),duplex:'half'} as RequestInit);
 assert.equal((await f.handler(hung)).status,400);assert.ok(Date.now()-start<2800);
 const controller=new AbortController();controller.abort();assert.equal((await f.send(undefined,{},'POST',controller.signal)).status,408);assert.equal(f.calls.length,0);
});
await test('consume before fixed claim/delete/finalize, bounded limit and count-only response',async()=>{
 const f=fixture(),wake=f.fresh({limit:1}),response=await f.send(wake);assert.equal(response.status,200);assert.deepEqual(await response.json(),{removedCount:1});assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(f.calls,[{name:'consume_invoice_receival_cleanup_run',args:{p_id:wake.run_id,p_exp:wake.exp,p_limit:1}},{name:'claim_expired_invoice_receival_sources',args:{p_limit:1}},{name:'finish_expired_invoice_receival_source_removal',args:{p_source_id:id}},{name:'finish_invoice_receival_cleanup_run',args:{p_id:wake.run_id,p_status:'succeeded',p_removed_count:1}}]);assert.deepEqual(f.removed,[[row.storagePath]]);
 const empty=fixture({rows:[]});assert.deepEqual(await(await empty.send()).json(),{removedCount:0});
});
await test('same signed wake is one-use across concurrent local HTTP requests',async()=>{
 const f=fixture();const results=await Promise.all(Array.from({length:8},()=>f.send()));assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,7);assert.equal(f.removed.length,1);
 assert.equal((await f.send()).status,409);assert.equal(f.calls.filter(c=>c.name==='claim_expired_invoice_receival_sources').length,1);
});
await test('cancelled queued wake and revoked global control fail closed',async()=>{
 for(const change of ['cancel','revoke']){const f=fixture();if(change==='cancel')f.ledger.get(f.wake.run_id)!.status='cancelled';else f.disable();assert.equal((await f.send()).status,409);assert.deepEqual(f.calls.map(c=>c.name),['consume_invoice_receival_cleanup_run']);assert.equal(f.removed.length,0);}
});
await test('uncertain consumption never starts source work or permits same-wake retry',async()=>{
 const f=fixture({fail:'consume'});assert.equal((await f.send()).status,503);assert.equal(f.ledger.get(f.wake.run_id)!.status,'running');assert.equal(f.calls.length,1);assert.equal(f.removed.length,0);assert.equal((await f.send()).status,503);assert.equal(f.calls.length,2);assert.equal(f.removed.length,0);
});
await test('untrusted claim shape cannot choose bucket/path or exceed signed limit',async()=>{
 for(const rows of [[{...row,storageBucket:'other'}],[{...row,storagePath:'../'+id+'/original'}],[{...row,storagePath:owner+'/'+id+'/another'}],[{...row,id:'invalid'}],[row,row],{},Array(21).fill(row)]){
  const f=fixture({rows});assert.equal((await f.send()).status,503);assert.equal(f.removed.length,0);assert.deepEqual(f.calls.map(c=>c.name),['consume_invoice_receival_cleanup_run','claim_expired_invoice_receival_sources','finish_invoice_receival_cleanup_run']);
 }
});
await test('delete failure never finalizes source; retry requires a fresh signed run',async()=>{
 const f=fixture({fail:'remove'}),response=await f.send();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'cleanup_incomplete'});assert.equal(f.calls.some(c=>c.name==='finish_expired_invoice_receival_source_removal'),false);assert.equal(f.ledger.get(f.wake.run_id)!.status,'failed');assert.equal((await f.send()).status,409);
 const resumed=fixture();assert.equal((await resumed.send(resumed.fresh())).status,200);
});
await test('cancellation after consumption halts later calls and preserves one-use nonce',async()=>{
 for(const at of ['claim_expired_invoice_receival_sources','remove']){
  const controller=new AbortController();const f=fixture({hook:async(name)=>{if(name===at)controller.abort();}});const response=await f.send(undefined,{},'POST',controller.signal);assert.equal(response.status,408);assert.equal(f.calls.some(c=>c.name==='finish_expired_invoice_receival_source_removal'),false);assert.equal(f.ledger.get(f.wake.run_id)!.status,'cancelled');assert.equal((await f.send()).status,409);
  if(at==='claim_expired_invoice_receival_sources')assert.equal(f.removed.length,0);
 }
});
await test('abort bounds a hung dependency; only count-only cancellation audit may follow',async()=>{
 const controller=new AbortController();let started!:()=>void;const waiting=new Promise<void>(resolve=>{started=resolve;});
 const f=fixture({hook:async(name)=>{if(name==='claim_expired_invoice_receival_sources'){started();await new Promise<void>(()=>{});}}});const result=f.send(undefined,{},'POST',controller.signal);await waiting;controller.abort();const deadline=new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('handler hung after abort')),250));assert.equal((await Promise.race([result,deadline])).status,408);assert.equal(f.removed.length,0);assert.equal(f.calls.at(-1)?.name,'finish_invoice_receival_cleanup_run');
});
await test('source/run finalization errors are sanitized and cannot replay consumed work',async()=>{
 for(const fail of ['claim_expired_invoice_receival_sources','finish_expired_invoice_receival_source_removal','run-finish']){const f=fixture({fail}),response=await f.send();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'cleanup_incomplete'});assert.equal((await f.send()).status,409);}
});
await test('entry keeps service key internal; migration is private/default OFF with no scheduled work',async()=>{
 const entry=readFileSync('supabase/functions/tenbot-receival-cleanup/index.ts','utf8'),sql=readFileSync('supabase/migrations/20261030200000_tenbot_receival_cleanup_wakes.sql','utf8');
 assert.match(entry,/TENBOT_RECEIVAL_CLEANUP_WAKE_SECRET/);assert.match(entry,/TENBOT_RECEIVAL_CLEANUP_ENABLED'\)==='true'/);assert.match(entry,/AbortSignal\.timeout\(15000\)/);assert.match(entry,/@supabase\/supabase-js@2\.101\.1/);assert.doesNotMatch(entry,/getUser|\.download\(|\.from\(['"](?:pending_receivals|vendor_catalog|jobs)/);
 assert.match(sql,/enabled boolean not null default false/);assert.match(sql,/is distinct from 'anon'/);assert.match(sql,/p_exp<=extract\(epoch from clock_timestamp\(\)\)\+120/);assert.match(sql,/status='queued' and consumed_at is null/);assert.match(sql,/request_limit between 1 and 20/);assert.doesNotMatch(sql,/cron\.(?:schedule|unschedule)|create_secret\(|update_secret\(|SUPABASE_SERVICE_ROLE_KEY|delete from (?:public\.)?invoice_receival_sources/i);
 const unchanged=[['20261030150000_invoice_receival_originals.sql','bf14113d1f14191da63155f881b2beed81b6d55f7746b0beaacb7892faa3ff00'],['20261030170000_invoice_original_storage_compatibility.sql','ab7e97580d5bce680000bca61def1dad0a0cd28f47e4c62d7b42fba8ec76e284'],['20261030180000_invoice_original_backend_fail_closed.sql','6ce88cd2d37d230d30bb65b044b17c7e40cefa273d65b269eed2999f673c0b03']];
 for(const [name,hash] of unchanged)assert.equal(createHash('sha256').update(readFileSync('supabase/migrations/'+name)).digest('hex'),hash);
});
console.log(JSON.stringify({mode:'real-local-crypto-http-with-ledger-doubles-only',databaseValidation:'not-run-new-migration-unapplied',groupsPassed:groups.length,groups},null,2));
