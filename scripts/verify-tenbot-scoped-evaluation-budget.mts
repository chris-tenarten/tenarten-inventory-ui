// Synthetic temporary journals only: no credential reads, network or live ledger.
import assert from 'node:assert/strict';
import fs,{chmodSync,existsSync,lstatSync,mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FIXED_RUN_ID,FIXED_TASK_IDS,openScopedEvaluationBudget} from './support/tenbot-scoped-evaluation-budget.mjs';

const groups:string[]=[];
async function test(name:string,run:()=>unknown|Promise<unknown>){await run();groups.push(name);}
const START=Date.parse('2026-11-01T20:00:00.000Z');
function setup(baseline=.5399555000000006){
 const directory=mkdtempSync(join(tmpdir(),'tenbot-scoped-budget-offline-')),journalPath=join(directory,'openai-budget.json'),source=join(directory,'synthetic-source.txt'),statePath=join(directory,`openai-evaluation-${FIXED_RUN_ID}.json`);
 const original={reservedOrSpentUsd:baseline,attempts:367,settled:367};
 writeFileSync(journalPath,JSON.stringify(original),{mode:0o600});writeFileSync(source,'synthetic scoped source\n',{mode:0o600});
 let clock=START;
 const options={journalPath,sourceFiles:[source],expiresAt:new Date(START+60_000).toISOString(),now:()=>clock};
 return {directory,journalPath,source,statePath,lockPath:join(directory,'openai-budget.lock'),original,options,clock(value:number){clock=value;},open:()=>openScopedEvaluationBudget(options),journal:()=>JSON.parse(readFileSync(journalPath,'utf8')),state:()=>JSON.parse(readFileSync(statePath,'utf8'))};
}
function faultRename(target:string,occurrence:number,run:()=>unknown|Promise<unknown>){
 const original=fs.renameSync;let calls=0;
 fs.renameSync=(oldPath,newPath)=>{if(String(newPath)===target&&++calls===occurrence)throw Error('synthetic-power-loss');return original(oldPath,newPath);};
 syncBuiltinESMExports();
 return Promise.resolve().then(run).finally(()=>{fs.renameSync=original;syncBuiltinESMExports();});
}

await test('fixed scope, owner-only permanent state, exact historical float and counters survive opening/close',()=>{
 const h=setup(),before=readFileSync(h.journalPath,'utf8'),meter=h.open(),snapshot=meter.snapshot();
 assert.equal(readFileSync(h.journalPath,'utf8'),before);assert.deepEqual(snapshot.journal,h.original);
 assert.equal(snapshot.run.runId,FIXED_RUN_ID);assert.deepEqual(snapshot.run.taskIds,FIXED_TASK_IDS);assert.equal(snapshot.remainingUsd,.25);
 assert.equal(lstatSync(h.statePath).mode&0o077,0);assert.equal(lstatSync(h.lockPath).mode&0o077,0);
 assert(!JSON.stringify(snapshot).includes('sha256'));assert(!('sources' in snapshot.run));
 meter.close();assert.equal(h.state().status,'closed');assert(!existsSync(h.lockPath));assert.equal(meter.snapshot().dispatchAllowed,false);
 assert.throws(()=>h.open(),/run-already-opened/);assert.equal(readFileSync(h.journalPath,'utf8'),before);
});
await test('reservation/measurement round UP and exact cap boundary prevents another charge',async()=>{
 const h=setup(),meter=h.open(),r=await meter.reserveBudget(FIXED_TASK_IDS[0],.25);
 assert.equal(meter.snapshot().run.accountedMicrousd,250000);assert.equal(meter.snapshot().dispatchAllowed,true);assert.equal(meter.snapshot().canReserve,false);
 assert.equal(h.journal().reservedOrSpentUsd,h.original.reservedOrSpentUsd+.25);
 r.settle(.2499991);assert.equal(meter.snapshot().run.accountedMicrousd,250000);
 await assert.rejects(meter.reserveBudget(FIXED_TASK_IDS[1],Number.MIN_VALUE),/budget-cap/);meter.close();
 const tiny=setup(),m=tiny.open(),a=await m.reserveBudget(FIXED_TASK_IDS[0],Number.MIN_VALUE);assert.equal(m.snapshot().run.accountedMicrousd,1);a.settle(1e-8);
 assert.equal(m.snapshot().run.accountedMicrousd,1);assert.equal(tiny.journal().reservedOrSpentUsd,tiny.original.reservedOrSpentUsd+.000001);m.close();
});
await test('global five-dollar cap includes conservative historical ceiling, never a fresh/reset allowance',async()=>{
 const h=setup(4.999999),meter=h.open();assert.equal(meter.snapshot().remainingUsd,.000001);
 await assert.rejects(meter.reserveBudget(FIXED_TASK_IDS[0],.000001000001),/budget-cap/);
 const r=await meter.reserveBudget(FIXED_TASK_IDS[0],.000001);r.settle(.000001);assert.equal(h.journal().reservedOrSpentUsd,5);assert.equal(h.journal().attempts,368);meter.close();
 const fractional=setup(4.999999000000001),f=fractional.open();assert.equal(f.snapshot().remainingUsd,0);await assert.rejects(f.reserveBudget(FIXED_TASK_IDS[0],Number.MIN_VALUE),/budget-cap/);f.close();
});
await test('one in-flight request admits only one concurrent reservation and supports both exact task IDs',async()=>{
 const h=setup(),meter=h.open(),results=await Promise.allSettled(FIXED_TASK_IDS.map(id=>meter.reserveBudget(id,.01)));
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(h.journal().attempts,368);
 const accepted=results.find(row=>row.status==='fulfilled')!;assert.equal(accepted.status,'fulfilled');accepted.value.settle(.001);
 const second=await meter.reserveBudget(FIXED_TASK_IDS[1],.01);second.settle(.002);assert.equal(h.journal().settled,369);assert.equal(meter.snapshot().run.accountedMicrousd,3000);meter.close();
});
await test('dispatch requires a currently held task-bound reservation before every request',async()=>{
 const h=setup(),meter=h.open();
 assert.equal(meter.snapshot().activeWindow,true);assert.equal(meter.snapshot().dispatchAllowed,false);assert.equal(meter.snapshot().canReserve,true);assert.equal(meter.snapshot().activeTaskId,null);
 const r=await meter.reserveBudget(FIXED_TASK_IDS[0],.01);assert.equal(meter.snapshot().dispatchAllowed,true);assert.equal(meter.snapshot().activeTaskId,FIXED_TASK_IDS[0]);assert.equal(meter.snapshot().activeReservationId,1);
 r.settle(.001);assert.equal(meter.snapshot().activeWindow,true);assert.equal(meter.snapshot().dispatchAllowed,false);assert.equal(meter.snapshot().activeTaskId,null);assert.equal(meter.snapshot().canReserve,true);
 const second=await meter.reserveBudget(FIXED_TASK_IDS[1],.01);assert.equal(meter.snapshot().activeTaskId,FIXED_TASK_IDS[1]);assert.equal(meter.snapshot().activeReservationId,2);second.settle(.001);meter.close();
});
await test('simultaneous separate processes atomically admit one open and preserve its permanent state',async()=>{
 const h=setup(),moduleUrl=new URL('./support/tenbot-scoped-evaluation-budget.mts',import.meta.url).href;
 const code=`import {openScopedEvaluationBudget} from ${JSON.stringify(moduleUrl)};try{const m=openScopedEvaluationBudget(${JSON.stringify({journalPath:h.journalPath,sourceFiles:[h.source],expiresAt:new Date(Date.now()+60_000).toISOString()})});m.close();process.stdout.write('opened');}catch{process.stdout.write('blocked');}`;
 const child=()=>new Promise<string>((resolve,reject)=>{const p=spawn(process.execPath,['--import','tsx','--input-type=module','-e',code],{cwd:fileURLToPath(new URL('..',import.meta.url)),stdio:['ignore','pipe','pipe']});let output='',error='';p.stdout.on('data',chunk=>{output+=String(chunk);});p.stderr.on('data',chunk=>{error+=String(chunk);});p.on('error',reject);p.on('exit',exit=>exit===0?resolve(output):reject(Error(error)));});
 const outcomes=await Promise.all([child(),child()]);assert.deepEqual(outcomes.sort(),['blocked','opened']);assert.equal(h.state().status,'closed');assert.deepEqual(h.journal(),h.original);
});
await test('existing historical lock is never removed, and concurrent state/journal writers fail closed',async()=>{
 const locked=setup();mkdirSync(locked.lockPath,{mode:0o700});const original=lstatSync(locked.lockPath).ino;assert.throws(()=>locked.open(),/EEXIST/);assert.equal(lstatSync(locked.lockPath).ino,original);assert(!existsSync(locked.statePath));
 for(const target of ['journal','state'] as const){const h=setup(),meter=h.open();const path=target==='journal'?h.journalPath:h.statePath;writeFileSync(path,readFileSync(path,'utf8')+' ');
  await assert.rejects(meter.reserveBudget(FIXED_TASK_IDS[0],.01),/concurrent-/);assert.throws(()=>meter.close(),/concurrent-/);assert(existsSync(h.lockPath));}
});
await test('invalid measurements retain full holds, stop future dispatch and reject later refunds',async()=>{
 for(const amount of [-1,NaN,Infinity,.010000001]){const h=setup(),meter=h.open(),r=await meter.reserveBudget(FIXED_TASK_IDS[0],.01);
  assert.throws(()=>r.settle(amount),/invalid-budget-measurement/);assert.equal(meter.snapshot().run.accountedMicrousd,10000);assert.equal(meter.snapshot().dispatchAllowed,false);
  assert.throws(()=>r.settle(0),/conflicting-settlement-replay/);await assert.rejects(meter.reserveBudget(FIXED_TASK_IDS[1],.01),/stopped/);
  assert.equal(h.journal().settled,367);meter.close();assert.equal(h.state().status,'closed');assert(existsSync(h.lockPath));}
});
await test('uncertainty is sticky: no measured replay/refund and no reopening',async()=>{
 const h=setup(),meter=h.open(),r=await meter.reserveBudget(FIXED_TASK_IDS[0],.01);r.settle();r.settle();
 assert.equal(h.journal().reservedOrSpentUsd,h.original.reservedOrSpentUsd+.01);assert.equal(h.journal().settled,367);assert.equal(meter.snapshot().run.reservations[0].status,'uncertain');
 assert.throws(()=>r.settle(0),/conflicting-settlement-replay/);meter.close();assert.throws(()=>h.open(),/run-already-opened/);assert(existsSync(h.lockPath));
});
await test('known settlement is exactly once; conflicting replay never changes accounting',async()=>{
 const h=setup(),meter=h.open(),r=await meter.reserveBudget(FIXED_TASK_IDS[0],.02);r.settle(.00100001);const before=readFileSync(h.journalPath,'utf8');r.settle(.00100001);
 assert.equal(meter.snapshot().run.accountedMicrousd,1001);assert.equal(h.journal().settled,368);assert.equal(readFileSync(h.journalPath,'utf8'),before);
 assert.throws(()=>r.settle(.002),/conflicting-settlement-replay/);assert.equal(readFileSync(h.journalPath,'utf8'),before);meter.close();
 const canceled=setup(),m=canceled.open(),zero=await m.reserveBudget(FIXED_TASK_IDS[0],.02);zero.settle(0);assert.deepEqual(canceled.journal(),{...canceled.original,attempts:368,settled:368});m.close();
});
await test('task scope, invalid reservations and expiry reject before journal mutation; outstanding measurement can settle',async()=>{
 const h=setup(),meter=h.open(),before=readFileSync(h.journalPath,'utf8');
 for(const task of ['',FIXED_TASK_IDS[0]+'-extra','other'])await assert.rejects(meter.reserveBudget(task,.01),/outside-approved-scope/);
 for(const amount of [0,-1,NaN,Infinity,.2500000001])await assert.rejects(meter.reserveBudget(FIXED_TASK_IDS[0],amount));
 assert.equal(readFileSync(h.journalPath,'utf8'),before);const r=await meter.reserveBudget(FIXED_TASK_IDS[0],.01);h.clock(START+60_000);
 assert.equal(meter.snapshot().expired,true);assert.equal(meter.snapshot().dispatchAllowed,false);await assert.rejects(meter.reserveBudget(FIXED_TASK_IDS[1],.01),/expired/);r.settle(.001);meter.close();assert.equal(h.state().status,'closed');
 for(const expiry of [START,START+15*60_000+1,NaN]){const invalid=setup();assert.throws(()=>openScopedEvaluationBudget({...invalid.options,expiresAt:Number.isNaN(expiry)?'invalid':new Date(expiry).toISOString()}),/expiry/);assert(!existsSync(invalid.lockPath));}
});
await test('source changes, corruption, nonprivate state and stop receipts preserve all reservations',async()=>{
 for(const mutate of [(h:ReturnType<typeof setup>)=>writeFileSync(h.source,'changed\n'),(h:ReturnType<typeof setup>)=>chmodSync(h.statePath,0o644),(h:ReturnType<typeof setup>)=>writeFileSync(join(h.directory,'openai-budget.stop.json'),'{}',{mode:0o600})]){
  const h=setup(),meter=h.open(),r=await meter.reserveBudget(FIXED_TASK_IDS[0],.01),before=readFileSync(h.journalPath,'utf8');mutate(h);
  assert.throws(()=>meter.snapshot());assert.throws(()=>r.settle(0));assert.equal(readFileSync(h.journalPath,'utf8'),before);assert(existsSync(h.lockPath));
 }
 for(const contents of ['{','{"reservedOrSpentUsd":0,"attempts":2,"settled":1}',JSON.stringify({reservedOrSpentUsd:5.1,attempts:0,settled:0})]){const h=setup();writeFileSync(h.journalPath,contents);assert.throws(()=>h.open());assert.equal(readFileSync(h.journalPath,'utf8'),contents);assert(existsSync(h.lockPath));}
});
await test('reserve crash before journal publication retains write-ahead hold and cannot dispatch/reopen',async()=>{
 const h=setup(),meter=h.open(),before=readFileSync(h.journalPath,'utf8');
 await faultRename(h.journalPath,1,async()=>{await assert.rejects(meter.reserveBudget(FIXED_TASK_IDS[0],.01),/synthetic-power-loss/);});
 assert.equal(readFileSync(h.journalPath,'utf8'),before);assert.equal(h.state().accountedMicrousd,10000);assert.equal(h.state().pending.kind,'reserve');assert(existsSync(h.journalPath+'.next'));
 assert.throws(()=>meter.snapshot());assert.throws(()=>h.open(),/run-already-opened/);assert(existsSync(h.lockPath));
});
await test('reserve crash after journal publication preserves charge plus pending state and never opens again',async()=>{
 const h=setup(),meter=h.open();await faultRename(h.statePath,2,async()=>{await assert.rejects(meter.reserveBudget(FIXED_TASK_IDS[0],.01),/synthetic-power-loss/);});
 assert.equal(h.journal().reservedOrSpentUsd,h.original.reservedOrSpentUsd+.01);assert.equal(h.state().accountedMicrousd,10000);assert.equal(h.state().pending.kind,'reserve');assert(existsSync(h.statePath+'.next'));assert.throws(()=>h.open());
});
await test('settlement crash keeps conservative state even after measured journal update',async()=>{
 const h=setup(),meter=h.open(),r=await meter.reserveBudget(FIXED_TASK_IDS[0],.02);
 await faultRename(h.statePath,2,()=>{assert.throws(()=>r.settle(.001),/synthetic-power-loss/);});
 assert.equal(h.state().accountedMicrousd,20000);assert.equal(h.state().pending.kind,'settle');assert.equal(h.journal().reservedOrSpentUsd,h.original.reservedOrSpentUsd+.001);assert.equal(h.journal().settled,368);assert.throws(()=>r.settle(0));assert.throws(()=>h.open());
});
await test('abandoning an outstanding request closes permanently and retains full accounting and lock',async()=>{
 const h=setup(),meter=h.open(),r=await meter.reserveBudget(FIXED_TASK_IDS[0],.01);meter.close();assert.equal(h.state().status,'closed');assert.equal(h.state().stopped,'unsettled-reservation-retained');assert(existsSync(h.lockPath));
 assert.throws(()=>r.settle(0),/closed/);assert.equal(h.journal().reservedOrSpentUsd,h.original.reservedOrSpentUsd+.01);assert.throws(()=>h.open());
});
await test('preexisting partial/corrupt state and journal recovery files are never overwritten',()=>{
 for(const target of ['state','state-next','journal-next'] as const){const h=setup(),path=target==='state'?h.statePath:target==='state-next'?h.statePath+'.next':h.journalPath+'.next';writeFileSync(path,'partial-recovery-evidence',{mode:0o600});assert.throws(()=>h.open(),/recovery|opened/);assert.equal(readFileSync(path,'utf8'),'partial-recovery-evidence');assert(!existsSync(h.lockPath));assert.deepEqual(h.journal(),h.original);}
});
console.log(JSON.stringify({passed:true,groupsPassed:groups.length,groups,mode:'synthetic temporary journals; real filesystem locks / deterministic crash injection',inferenceCalls:0,credentialReads:0,liveJournalReads:0,liveJournalWrites:0,hostedMutations:0}));
