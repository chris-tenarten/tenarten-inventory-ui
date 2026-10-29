// Local TenBot tooling only. Reuses an existing fixture; never starts, seeds or repairs it.
import {spawnSync} from 'node:child_process';
import {admin,member} from './sample-batch-database.mjs';

export class TenbotFixtureError extends Error {
 constructor(code,message,phase='fixture-validation'){super(message);this.name='TenbotFixtureError';this.code=code;this.phase=phase;}
}
const containerName=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(value);
const permission=/permission denied|operation not permitted|access (?:is )?denied|unauthori[sz]ed|forbidden/i;
const disconnected=/cannot connect to (?:the )?docker daemon|is the docker daemon running|error during connect|failed to connect.*docker|dial unix.*(?:connection refused|no such file)|connect: connection refused/i;
const fail=(code,message,phase)=>{throw new TenbotFixtureError(code,message,phase);};

/** Dependency injection is per instance for offline tests, never global config. */
export function createTenbotFixtureHealth({spawn=spawnSync}={}){
 function runDocker(args,{input,timeoutMs=5000,phase='docker-command'}={}){
  if(!Array.isArray(args)||!args.length||args.some(arg=>typeof arg!=='string'||arg.includes('\0'))||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||typeof phase!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(phase)||input!==undefined&&typeof input!=='string')fail('fixture-options-invalid','Invalid local fixture command options.','fixture-validation');
  let result;
  try{result=spawn('docker',args,{input,encoding:'utf8',maxBuffer:16*1024*1024,timeout:timeoutMs,killSignal:'SIGKILL'});}catch(error){
   const code=error&&typeof error==='object'?error.code:undefined;
   if(code==='ENOENT')fail('docker-cli-missing','Docker CLI is unavailable; no fixture or inference action was attempted.',phase);
   if(code==='EACCES'||code==='EPERM')fail('docker-access-denied','Docker access was denied; this does not establish fixture readiness.',phase);
   if(code==='ETIMEDOUT')fail('docker-unresponsive','Docker command exceeded its local process deadline; fixture state is unknown.',phase);
   fail('docker-command-failed','Local Docker command failed; fixture state is unknown.',phase);
  }
  const stderr=typeof result?.stderr==='string'?result.stderr:'';
  const errorCode=result?.error?.code;
  const postgresDiagnostic=phase==='fixture-sql'&&/\b(?:ERROR|FATAL|PANIC):/.test(stderr);
  // Some restricted Docker invocations report a permission failure with status 0.
  if(errorCode==='EACCES'||errorCode==='EPERM'||permission.test(stderr)&&!postgresDiagnostic)fail('docker-access-denied','Docker access was denied; this does not establish fixture readiness.',phase);
  if(errorCode==='ENOENT')fail('docker-cli-missing','Docker CLI is unavailable; no fixture or inference action was attempted.',phase);
  if(errorCode==='ETIMEDOUT')fail('docker-unresponsive','Docker command exceeded its local process deadline; fixture state is unknown.',phase);
  if(disconnected.test(stderr))fail('docker-daemon-unavailable','Docker daemon connection is unavailable; no fixture startup or inference was attempted.',phase);
  if(result?.status!==0||result?.signal||result?.error){
   if(phase==='fixture-inspect'&&/no such (?:object|container)/i.test(stderr))fail('fixture-missing','The existing TenBot fixture container is absent; automatic creation is disabled.',phase);
   if(phase==='fixture-postgres'&&result?.status===1)fail('fixture-not-ready','The existing TenBot PostgreSQL fixture is rejecting connections.',phase);
   if(phase==='fixture-postgres'&&result?.status===2)fail('fixture-startup-timeout','The existing TenBot PostgreSQL fixture did not answer its readiness probe.',phase);
   if(phase==='fixture-sql')fail('fixture-sql-failed','Local fixture SQL failed; no caller authorization or schema-readiness conclusion was established.',phase);
   fail('docker-command-failed','Local Docker command failed; no automatic fixture repair was attempted.',phase);
  }
  if(typeof result.stdout!=='string')fail('docker-command-failed','Local Docker command returned an invalid response.',phase);
  return result.stdout.trim();
 }
 function sql(name,statement){
  if(!containerName(name)||typeof statement!=='string'||!statement.trim()||statement.includes('\0'))fail('fixture-options-invalid','Invalid local fixture SQL invocation.','fixture-sql');
  return runDocker(['exec','-i',name,'psql','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:statement,timeoutMs:5000,phase:'fixture-sql'}).split('\n').filter(value=>value!==admin&&value!==member).join('\n');
 }
 function assertTenbotFixtureReady({container='tenops-tenbot-review',timeoutMs=5000}={}){
  if(!containerName(container))fail('fixture-options-invalid','Invalid local TenBot fixture container name.','fixture-validation');
  const version=runDocker(['info','--format','{{.ServerVersion}}'],{timeoutMs,phase:'daemon-info'});
  if(!/^\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z._+-]+)?$/.test(version))fail('docker-daemon-unavailable','Docker did not return a usable server version; fixture state is unknown.','daemon-info');
  const raw=runDocker(['inspect','--format','{{json .State}}',container],{timeoutMs,phase:'fixture-inspect'});
  let state;try{state=JSON.parse(raw);}catch{fail('fixture-state-invalid','The existing TenBot fixture state response is invalid.','fixture-inspect');}
  if(!state||typeof state!=='object'||Array.isArray(state)||typeof state.Running!=='boolean'||typeof state.Status!=='string')fail('fixture-state-invalid','The existing TenBot fixture state response is invalid.','fixture-inspect');
  if(!state.Running||state.Dead===true)fail('fixture-stopped','The existing TenBot fixture is stopped; automatic startup is disabled.','fixture-inspect');
  if(state.Paused===true||state.Restarting===true||state.Status!=='running')fail('fixture-not-ready','The existing TenBot fixture is not in a usable running state.','fixture-inspect');
  const ready=runDocker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres','-t','3'],{timeoutMs,phase:'fixture-postgres'});
  if(!/(?:^| - )accepting connections(?:\s|$)/i.test(ready))fail('fixture-not-ready','The existing TenBot PostgreSQL fixture returned no usable readiness confirmation.','fixture-postgres');
  return {container,dockerServerVersion:version,containerState:'running',postgres:'ready',reuseOnly:true};
 }
 return {runDocker,sql,assertTenbotFixtureReady};
}
const local=createTenbotFixtureHealth();
export const runDocker=local.runDocker;
export const sql=local.sql;
export const assertTenbotFixtureReady=local.assertTenbotFixtureReady;
