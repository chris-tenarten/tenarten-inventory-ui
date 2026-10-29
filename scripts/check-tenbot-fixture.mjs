// Read-only preflight. No credential loading, inference, fixture setup or restart.
import {assertTenbotFixtureReady,sql,TenbotFixtureError} from './support/tenbot-fixture-health.mjs';
import {jobFixture,TENBOT_JOB_DATABASE} from './support/tenbot-job-database.mjs';
import {literal} from './support/intake-materials-database.mjs';

const started=performance.now();
try{
 const health=assertTenbotFixtureReady();
 const allowed=sql(TENBOT_JOB_DATABASE,`begin read only;set local role authenticated;set local request.jwt.claim.sub=${literal(jobFixture.actor)};set local statement_timeout='3s';select public.has_app_capability('readOperationalData');rollback;`)==='t';
 if(!allowed)throw new TenbotFixtureError('fixture-authorization-denied','Existing synthetic caller lacks readOperationalData; fixture validation stopped.');
 console.log(JSON.stringify({status:'ready',health,callerReadAuthorized:true,elapsedMs:Math.round(performance.now()-started),inferenceCalls:0,databaseMutations:0}));
}catch(error){
 const known=error instanceof TenbotFixtureError;
 console.error(JSON.stringify({status:'blocked',code:known?error.code:'fixture-check-failed',message:known?error.message:'Local fixture check failed; no inference attempted.',phase:known?error.phase:undefined,elapsedMs:Math.round(performance.now()-started),inferenceCalls:0,databaseMutations:0}));
 process.exitCode=2;
}
