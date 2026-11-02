// One expressly approved local evaluation. Importing performs no I/O, credential
// access or inference. Permanent state and ambiguous locks are never removed.
import {createHash} from 'node:crypto';
import {closeSync,existsSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,renameSync,rmdirSync,writeFileSync} from 'node:fs';
import {basename,dirname,isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const FIXED_RUN_ID='6dce9700-683a-4c19-8684-3a45dc550b30';
export const FIXED_TASK_IDS=Object.freeze(['job-schedule-labor','compound-production-briefing'] as const);
const RUN_CAP_MICROUSD=250_000,GLOBAL_CAP_MICROUSD=5_000_000,MAX_DURATION_MS=15*60_000;
type Journal=Record<string,unknown>&{reservedOrSpentUsd:number;attempts:number;settled:number};
type SourcePin={path:string;identity:string;sha256:string};
type Reservation={id:number;taskId:string;reservedMicrousd:number;actualMicrousd:number|null;status:'reserved'|'measured'|'uncertain'};
type RunState={version:1;runId:typeof FIXED_RUN_ID;taskIds:readonly string[];runCapMicrousd:number;globalCapMicrousd:number;openedAt:number;expiresAt:number;status:'open'|'closed';stopped:string|null;baseline:Journal;baselineJournalSha256:string;sources:SourcePin[];accountedMicrousd:number;reservations:Reservation[];pending:null|{kind:'reserve'|'settle';beforeJournalSha256:string;afterJournalSha256:string}};
type Options={journalPath:string;sourceFiles:readonly string[];expiresAt:string;now?:()=>number};
type FileImage={raw:string;identity:string};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const encode=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);

/** Decimal ceiling, including subnormal/scientific values, without float epsilon. */
function micro(usd:number){
 if(typeof usd!=='number'||!Number.isFinite(usd)||usd<0||usd>5)throw Error('invalid-budget-amount');
 const [mantissa,exponent='0']=usd.toString().toLowerCase().split('e'),[whole,fraction='']=mantissa.split('.');
 const digits=BigInt(whole+fraction),scale=fraction.length-Number(exponent)-6,ten=BigInt(10),one=BigInt(1);
 return Number(scale<=0?digits*ten**BigInt(-scale):(digits+ten**BigInt(scale)-one)/ten**BigInt(scale));
}
function identity(path:string,privateFile:boolean,directory=false){
 const s=lstatSync(path,{bigint:true});
 if(s.isSymbolicLink()||!(directory?s.isDirectory():s.isFile())||s.uid!==BigInt(process.getuid!())||privateFile&&(s.mode&BigInt(0o077))!==BigInt(0))throw Error('owned-file-required');
 return [s.dev,s.ino,s.mode,s.size,s.mtimeNs,s.ctimeNs].join(':');
}
function readImage(path:string,privateFile:boolean):FileImage{
 const before=identity(path,privateFile),raw=readFileSync(path,'utf8');
 if(identity(path,privateFile)!==before)throw Error('concurrent-file-change');
 return {raw,identity:before};
}
function readJournal(raw:string):Journal{
 const value:unknown=JSON.parse(raw);
 if(!object(value)||typeof value.reservedOrSpentUsd!=='number'||!Number.isFinite(value.reservedOrSpentUsd)||value.reservedOrSpentUsd<0||value.reservedOrSpentUsd>5||!Number.isSafeInteger(value.attempts)||Number(value.attempts)<0||!Number.isSafeInteger(value.settled)||Number(value.settled)<0||value.attempts!==value.settled)throw Error('journal-reconciliation-required');
 return value as Journal;
}
function syncDirectory(path:string){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
function writeExclusive(path:string,raw:string){
 const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,raw);fsyncSync(fd);}finally{closeSync(fd);}
 syncDirectory(dirname(path));
}
function replace(path:string,raw:string,expected:FileImage){
 // A surviving .next is recovery evidence, never permission to overwrite it.
 if(!same(readImage(path,true),expected))throw Error('concurrent-file-writer');
 const temporary=path+'.next';writeExclusive(temporary,raw);
 if(!same(readImage(path,true),expected))throw Error('concurrent-file-writer');
 renameSync(temporary,path);syncDirectory(dirname(path));
 return readImage(path,true);
}

/**
 * Holds the original journal's atomic mkdir lock for the complete run. Any
 * existing fixed state rejects opening, including closed or partial state.
 * There is intentionally no reset, resume, unlock-recovery or new-run API.
 */
export function openScopedEvaluationBudget(options:Options){
 if(!process.getuid||!isAbsolute(options.journalPath)||resolve(options.journalPath)!==options.journalPath||basename(options.journalPath)!=='openai-budget.json'||!Array.isArray(options.sourceFiles)||options.sourceFiles.length<1)throw Error('invalid-run-configuration');
 const now=options.now??Date.now,openedAt=now(),expiresAt=Date.parse(options.expiresAt);
 if(!Number.isSafeInteger(openedAt)||!Number.isSafeInteger(expiresAt)||expiresAt<=openedAt||expiresAt-openedAt>MAX_DURATION_MS)throw Error('invalid-run-expiry');
 const directory=dirname(options.journalPath),journalPath=options.journalPath,lockPath=join(directory,'openai-budget.lock'),stopPath=join(directory,'openai-budget.stop.json');
 const statePath=join(directory,`openai-evaluation-${FIXED_RUN_ID}.json`);
 const sourcePaths=[...new Set([fileURLToPath(import.meta.url),...options.sourceFiles])];
 if(sourcePaths.some(path=>!isAbsolute(path)||resolve(path)!==path)||sourcePaths.includes(journalPath)||sourcePaths.includes(statePath))throw Error('invalid-source-pins');
 identity(directory,false,true);
 if(existsSync(statePath)||existsSync(statePath+'.next'))throw Error('run-already-opened-or-recovery-required');
 if(existsSync(stopPath)||existsSync(journalPath+'.next'))throw Error('budget-stop-or-recovery-required');
 // Never inspect and remove a preexisting lock. Only a successful mkdir below
 // establishes our ownership, and failures after it preserve the lock.
 mkdirSync(lockPath,{mode:0o700});const lockIdentity=identity(lockPath,true,true);
 let journalImage=readImage(journalPath,true),journal=readJournal(journalImage.raw);
 const sources=sourcePaths.map(path=>{const image=readImage(path,false);return {path,identity:image.identity,sha256:hash(image.raw)};});
 const baseline=structuredClone(journal),baselineMicro=micro(baseline.reservedOrSpentUsd);
 let state:RunState={version:1,runId:FIXED_RUN_ID,taskIds:[...FIXED_TASK_IDS],runCapMicrousd:RUN_CAP_MICROUSD,globalCapMicrousd:GLOBAL_CAP_MICROUSD,openedAt,expiresAt,status:'open',stopped:null,baseline,baselineJournalSha256:hash(journalImage.raw),sources,accountedMicrousd:0,reservations:[],pending:null};
 writeExclusive(statePath,encode(state));let stateImage=readImage(statePath,true),fatal:string|null=null,released=false;

 function checkFiles(checkSources=true){
  if(fatal)throw Error(fatal);
  try{
   if(released||identity(lockPath,true,true)!==lockIdentity)throw Error('budget-lock-changed');
   if(existsSync(stopPath)||existsSync(journalPath+'.next')||existsSync(statePath+'.next'))throw Error('budget-stop-or-recovery-required');
   if(!same(readImage(journalPath,true),journalImage))throw Error('concurrent-budget-writer');
   if(!same(readImage(statePath,true),stateImage))throw Error('concurrent-run-state-writer');
   if(checkSources)for(const pin of sources){const current=readImage(pin.path,false);if(current.identity!==pin.identity||hash(current.raw)!==pin.sha256)throw Error('source-file-changed');}
  }catch(error){fatal=error instanceof Error?error.message:'budget-integrity-failure';throw error;}
 }
 function writeState(next:RunState){stateImage=replace(statePath,encode(next),stateImage);state=next;}
 function transaction(kind:'reserve'|'settle',next:RunState,nextJournal:Journal){
  checkFiles();const nextRaw=encode(nextJournal);
  // Keep conservative state BEFORE reducing any journal hold or returning a
  // reservation. A crash anywhere leaves pending state / lock and cannot reopen.
  const prepared=kind==='reserve'?next:state;
  writeState({...prepared,pending:{kind,beforeJournalSha256:hash(journalImage.raw),afterJournalSha256:hash(nextRaw)}});
  try{
   checkFiles();journalImage=replace(journalPath,nextRaw,journalImage);journal=nextJournal;
   checkFiles();writeState({...next,pending:null});checkFiles();
  }catch(error){fatal=error instanceof Error?error.message:'budget-transaction-incomplete';throw error;}
 }
 function currentTime(){const value=now();if(!Number.isSafeInteger(value)||value<openedAt)throw Error('invalid-run-clock');return value;}
 function assertTask(taskId:string){if(!FIXED_TASK_IDS.some(id=>id===taskId))throw Error('task-outside-approved-scope');}
 function stop(reason:string,id:number){checkFiles();writeState({...state,stopped:reason,reservations:state.reservations.map(item=>item.id===id?{...item,status:'uncertain'}:item)});}
 function calculatedJournal(accountedMicrousd:number,attempts:number,settled:number):Journal{
  // Preserve the historical floating baseline and every unrelated journal key;
  // only this run's integer micro-dollar delta is added or subtracted.
  if(!Number.isSafeInteger(baseline.attempts+attempts)||!Number.isSafeInteger(baseline.settled+settled))throw Error('journal-counter-overflow');
  return {...baseline,reservedOrSpentUsd:baseline.reservedOrSpentUsd+accountedMicrousd/1_000_000,attempts:baseline.attempts+attempts,settled:baseline.settled+settled};
 }
 function counts(rows:Reservation[]){return {attempts:rows.length,settled:rows.filter(row=>row.status==='measured').length};}
 function snapshot(){
  // A normally closed run remains inspectable without recreating its lock.
  if(!released)checkFiles();else if(!same(readImage(statePath,true),stateImage)||!same(readImage(journalPath,true),journalImage))throw Error('closed-budget-changed');
  const expired=currentTime()>=expiresAt;
  const activeWindow=!released&&state.status==='open'&&!state.stopped&&!state.pending&&!expired;
  const reserved=state.reservations.filter(row=>row.status==='reserved');
  const dispatchAllowed=activeWindow&&reserved.length===1&&!state.reservations.some(row=>row.status==='uncertain');
  const canReserve=activeWindow&&state.reservations.every(row=>row.status==='measured');
  const remainingUsd=activeWindow?Math.max(0,Math.min(RUN_CAP_MICROUSD-state.accountedMicrousd,GLOBAL_CAP_MICROUSD-baselineMicro-state.accountedMicrousd))/1_000_000:0;
  const {sources:privatePins,...publicState}=state;
  return {run:{...structuredClone(publicState),sourceFiles:privatePins.map(pin=>pin.path)},journal:structuredClone(journal),remainingUsd,expired,activeWindow,dispatchAllowed,canReserve,activeTaskId:dispatchAllowed?reserved[0].taskId:null,activeReservationId:dispatchAllowed?reserved[0].id:null,statePath,lockPath};
 }
 async function reserveBudget(taskId:string,usd:number){
  checkFiles();assertTask(taskId);
  if(state.status!=='open'||state.stopped||state.pending||currentTime()>=expiresAt)throw Error('scoped-run-closed-stopped-or-expired');
  if(state.reservations.some(row=>row.status!=='measured'))throw Error('one-inflight-request-only');
  const held=micro(usd);
  if(held<1)throw Error('invalid-budget-amount');
  if(state.accountedMicrousd+held>RUN_CAP_MICROUSD||baselineMicro+state.accountedMicrousd+held>GLOBAL_CAP_MICROUSD)throw Error('scoped-or-global-budget-cap');
  const row:Reservation={id:state.reservations.length+1,taskId,reservedMicrousd:held,actualMicrousd:null,status:'reserved'},rows=[...state.reservations,row],accounted=state.accountedMicrousd+held;
  const count=counts(rows);transaction('reserve',{...state,reservations:rows,accountedMicrousd:accounted},calculatedJournal(accounted,count.attempts,count.settled));
  return {settle(actualUsd?:number){
   checkFiles();const current=state.reservations.find(item=>item.id===row.id)!;
   if(current.status!=='reserved'){
    if(current.status==='measured'&&actualUsd!==undefined&&Number.isFinite(actualUsd)&&actualUsd>=0&&micro(actualUsd)===current.actualMicrousd||current.status==='uncertain'&&actualUsd===undefined)return;
    throw Error('conflicting-settlement-replay');
   }
   if(state.status!=='open'||state.pending)throw Error('scoped-run-closed-or-incomplete');
   let actual:number|null=null;
   if(actualUsd!==undefined){
    try{actual=micro(actualUsd);if(actual>held)throw Error('settlement-exceeds-reservation');}
    catch{stop('invalid-measurement-full-reservation-retained',row.id);throw Error('invalid-budget-measurement');}
   }
   if(actual===null){
    writeState({...state,stopped:'unknown-outcome-full-reservation-retained',reservations:state.reservations.map(item=>item.id===row.id?{...item,status:'uncertain'}:item)});return;
   }
   const settledRows=state.reservations.map(item=>item.id===row.id?{...item,status:'measured' as const,actualMicrousd:actual}:item),accounted=state.accountedMicrousd-held+actual,count=counts(settledRows);
   transaction('settle',{...state,reservations:settledRows,accountedMicrousd:accounted},calculatedJournal(accounted,count.attempts,count.settled));
  }};
 }
 function close(){
  if(released)return;
  checkFiles(false);
  if(state.status!=='closed')writeState({...state,status:'closed',stopped:state.stopped??(state.reservations.some(row=>row.status!=='measured')?'unsettled-reservation-retained':null)});
  // Unknown / abandoned requests retain the lock as well as their full holds.
  if(state.stopped||state.pending)return;
  checkFiles(false);rmdirSync(lockPath);syncDirectory(directory);released=true;
 }
 checkFiles();return {reserveBudget,snapshot,close};
}
