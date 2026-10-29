// All child-process responses are injected. No Docker, database, credentials or network calls.
import assert from 'node:assert/strict';
import {createTenbotFixtureHealth,TenbotFixtureError} from './support/tenbot-fixture-health.mjs';
import {admin,member} from './support/sample-batch-database.mjs';

const checks=[];
function check(name,action){action();checks.push(name);}
const ok=stdout=>({status:0,stdout,stderr:'',signal:null});
const running=()=>ok(JSON.stringify({Running:true,Status:'running',Paused:false,Restarting:false,Dead:false}));
function fixture(queue){const calls=[];const health=createTenbotFixtureHealth({spawn(command,args,options){calls.push({command,args,options});assert(queue.length,'Unexpected subprocess request');const next=queue.shift();if(typeof next==='function')return next(command,args,options);return next;}});return {...health,calls};}
function rejects(action,code,phase){assert.throws(action,error=>error instanceof TenbotFixtureError&&error.code===code&&(!phase||error.phase===phase)&&!String(error).includes('PRIVATE_SENTINEL'));}

check('Ready preflight is sequential, bounded and limited to the exact existing container',()=>{
 const h=fixture([ok('28.5.1\n'),running(),ok('127.0.0.1:5432 - accepting connections\n')]);
 assert.deepEqual(h.assertTenbotFixtureReady(),{container:'tenops-tenbot-review',dockerServerVersion:'28.5.1',containerState:'running',postgres:'ready',reuseOnly:true});
 assert.deepEqual(h.calls.map(row=>row.args),[['info','--format','{{.ServerVersion}}'],['inspect','--format','{{json .State}}','tenops-tenbot-review'],['exec','tenops-tenbot-review','pg_isready','-h','127.0.0.1','-U','postgres','-t','3']]);
 for(const call of h.calls){assert.equal(call.command,'docker');assert.equal(call.options.timeout,5000);assert.equal(call.options.killSignal,'SIGKILL');assert.equal(call.options.encoding,'utf8');assert(!call.args.some(arg=>['run','start','restart','rm','kill'].includes(arg)));}
});
check('Explicit timeout overrides are instance-local and reach every process call',()=>{
 const h=fixture([ok('28.5.1'),running(),ok('accepting connections')]);h.assertTenbotFixtureReady({timeoutMs:1234});assert(h.calls.every(row=>row.options.timeout===1234));
});
check('Missing CLI stops before inspection or fixture operations',()=>{
 const h=fixture([{status:null,error:{code:'ENOENT'},stdout:'PRIVATE_SENTINEL',stderr:'PRIVATE_SENTINEL'}]);rejects(()=>h.assertTenbotFixtureReady(),'docker-cli-missing','daemon-info');assert.equal(h.calls.length,1);
});
check('Process timeout is distinct from fixture readiness and stops subsequent operations',()=>{
 const h=fixture([{status:null,error:{code:'ETIMEDOUT'},signal:'SIGKILL',stdout:'PRIVATE_SENTINEL',stderr:''}]);rejects(()=>h.assertTenbotFixtureReady(),'docker-unresponsive','daemon-info');assert.equal(h.calls.length,1);
});
check('EACCES and EPERM are access failures rather than absent fixtures',()=>{
 for(const code of ['EACCES','EPERM']){const h=fixture([{status:null,error:{code},stderr:'PRIVATE_SENTINEL'}]);rejects(()=>h.assertTenbotFixtureReady(),'docker-access-denied','daemon-info');assert.equal(h.calls.length,1);}
});
check('Permission stderr fails closed even when Docker reports exit zero and a version',()=>{
 const h=fixture([{...ok('28.5.1'),stderr:'permission denied PRIVATE_SENTINEL'}]);rejects(()=>h.assertTenbotFixtureReady(),'docker-access-denied','daemon-info');assert.equal(h.calls.length,1);
});
check('Daemon connection errors never trigger container inspection or creation',()=>{
 const h=fixture([{status:1,stdout:'',stderr:'Cannot connect to the Docker daemon. Is the docker daemon running? PRIVATE_SENTINEL'}]);rejects(()=>h.assertTenbotFixtureReady(),'docker-daemon-unavailable','daemon-info');assert.equal(h.calls.length,1);
});
check('Empty or unusable server versions are not readiness evidence',()=>{
 for(const version of ['', '\n', 'PRIVATE_SENTINEL', 'null']){const h=fixture([ok(version)]);rejects(()=>h.assertTenbotFixtureReady(),'docker-daemon-unavailable','daemon-info');assert.equal(h.calls.length,1);}
});
check('Missing fixture is distinguished after a responsive daemon without startup fallback',()=>{
 const h=fixture([ok('28.5.1'),{status:1,stdout:'',stderr:'Error: No such object: PRIVATE_SENTINEL'}]);rejects(()=>h.assertTenbotFixtureReady(),'fixture-missing','fixture-inspect');assert.equal(h.calls.length,2);
});
check('Stopped fixture is not automatically started',()=>{
 const h=fixture([ok('28.5.1'),ok('{"Running":false,"Status":"exited"}')]);rejects(()=>h.assertTenbotFixtureReady(),'fixture-stopped','fixture-inspect');assert.equal(h.calls.length,2);
});
check('Paused and restarting fixtures are not treated as usable',()=>{
 for(const state of [{Running:true,Status:'running',Paused:true},{Running:true,Status:'restarting',Restarting:true}]){const h=fixture([ok('28.5.1'),ok(JSON.stringify(state))]);rejects(()=>h.assertTenbotFixtureReady(),'fixture-not-ready','fixture-inspect');assert.equal(h.calls.length,2);}
});
check('Malformed state cannot fall through to PostgreSQL',()=>{
 for(const state of ['PRIVATE_SENTINEL','null','[]','{}','{"Running":true}']){const h=fixture([ok('28.5.1'),ok(state)]);rejects(()=>h.assertTenbotFixtureReady(),'fixture-state-invalid','fixture-inspect');assert.equal(h.calls.length,2);}
});
check('PostgreSQL rejecting connections differs from a PostgreSQL readiness timeout',()=>{
 for(const [status,code] of [[1,'fixture-not-ready'],[2,'fixture-startup-timeout']]){const h=fixture([ok('28.5.1'),running(),{status,stdout:'PRIVATE_SENTINEL',stderr:''}]);rejects(()=>h.assertTenbotFixtureReady(),code,'fixture-postgres');assert.equal(h.calls.length,3);}
});
check('A hung Docker exec remains a process timeout rather than a PostgreSQL diagnosis',()=>{
 const h=fixture([ok('28.5.1'),running(),{status:null,error:{code:'ETIMEDOUT'},signal:'SIGKILL',stderr:''}]);rejects(()=>h.assertTenbotFixtureReady(),'docker-unresponsive','fixture-postgres');
});
check('Unknown nonzero status and unexpected child signals remain generic command failures',()=>{
 for(const result of [{status:7,stdout:'PRIVATE_SENTINEL',stderr:'PRIVATE_SENTINEL'},{status:null,signal:'SIGTERM',stdout:'PRIVATE_SENTINEL',stderr:''}]){const h=fixture([result]);rejects(()=>h.assertTenbotFixtureReady(),'docker-command-failed','daemon-info');}
});
check('Thrown spawn errors use the same safe classifications',()=>{
 for(const [source,code] of [['ENOENT','docker-cli-missing'],['EACCES','docker-access-denied'],['ETIMEDOUT','docker-unresponsive'],['UNKNOWN','docker-command-failed']]){const h=fixture([()=>{throw Object.assign(new Error('PRIVATE_SENTINEL'),{code:source});}]);rejects(()=>h.assertTenbotFixtureReady(),code,'daemon-info');}
});
check('SQL preserves the established stdin protocol and identity-line filtering with a five-second limit',()=>{
 const statement='select PRIVATE_SENTINEL;';const h=fixture([ok(`${admin}\n${member}\n{"synthetic":true}\n`)]);assert.equal(h.sql('tenops-tenbot-review',statement),'{"synthetic":true}');
 assert.deepEqual(h.calls[0].args,['exec','-i','tenops-tenbot-review','psql','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']);assert.equal(h.calls[0].options.input,statement);assert.equal(h.calls[0].options.timeout,5000);assert.equal(h.calls[0].options.killSignal,'SIGKILL');
});
check('SQL failure exposes neither statement nor stdout, stderr or raw process error',()=>{
 const h=fixture([{status:1,stdout:'PRIVATE_SENTINEL',stderr:'PRIVATE_SENTINEL',error:new Error('PRIVATE_SENTINEL')}]);rejects(()=>h.sql('tenops-tenbot-review','select PRIVATE_SENTINEL;'),'fixture-sql-failed','fixture-sql');
});
check('PostgreSQL permission diagnostics do not masquerade as Docker access failures',()=>{
 for(const stderr of ['ERROR: permission denied for function PRIVATE_SENTINEL','psql:<stdin>:4: ERROR: permission denied for relation PRIVATE_SENTINEL','FATAL: access denied PRIVATE_SENTINEL']){const h=fixture([{status:1,stdout:'',stderr}]);rejects(()=>h.sql('tenops-tenbot-review','select PRIVATE_SENTINEL;'),'fixture-sql-failed','fixture-sql');}
});
check('Invalid arguments and deadlines fail before any child process',()=>{
 const h=fixture([]);for(const timeoutMs of [0,-1,30001,NaN,Infinity,1.5])rejects(()=>h.runDocker(['info'],{timeoutMs}),'fixture-options-invalid');
 rejects(()=>h.assertTenbotFixtureReady({container:'--all'}),'fixture-options-invalid');rejects(()=>h.sql('--all','select 1'),'fixture-options-invalid');rejects(()=>h.runDocker(['info'],{phase:'PRIVATE_SENTINEL sql'}),'fixture-options-invalid');assert.equal(h.calls.length,0);
});
check('Exit-zero PostgreSQL output still requires a usable readiness confirmation',()=>{
 for(const output of ['', 'not accepting connections']){const h=fixture([ok('28.5.1'),running(),ok(output)]);rejects(()=>h.assertTenbotFixtureReady(),'fixture-not-ready','fixture-postgres');}
});
check('Errors support phase metadata without exposing arguments or captured process output',()=>{
 const error=new TenbotFixtureError('fixture-authorization-denied','Synthetic caller is not authorized.');assert.equal(error.phase,'fixture-validation');assert.equal(error.code,'fixture-authorization-denied');
});

console.log(JSON.stringify({passed:true,groups:checks.length,checks,mode:'offline injected child-process results only',dockerCalls:0,databaseCalls:0,inferenceCalls:0,credentialReads:0},null,2));
