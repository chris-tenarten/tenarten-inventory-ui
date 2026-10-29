// Local simulated-session wiring only; no model inference, Docker or hosted access.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const server=JSON.parse(readFileSync('/private/tmp/tenops-tenbot-agent-poc/server.json','utf8'));
assert.equal(server.mode,'synthetic-live');assert.equal(server.simulation,true);
const token=sub=>'fixture.'+Buffer.from(JSON.stringify({sub})).toString('base64url')+'.local';
async function request(origin,authorization){const result=await fetch('http://localhost:55595',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(authorization?{Authorization:'Bearer '+authorization}:{})},body:JSON.stringify({action:'status'}),signal:AbortSignal.timeout(3000)});return {status:result.status,body:await result.json()};}
const correct='http://localhost:3000';
assert.equal((await request(correct)).status,401);
assert.equal((await request(correct,token('not-a-uuid'))).status,401);
assert.equal((await request('http://localhost:3001',token('00000000-0000-4000-8000-000000000021'))).status,403);
const valid=await request(correct,token('00000000-0000-4000-8000-000000000021'));assert.equal(valid.status,200);assert.equal(valid.body.mode,'synthetic-live');assert.equal(valid.body.simulation,true);
const receipt={passed:true,groups:4,checks:['Missing fixture session denied','Malformed owner denied','Wrong origin denied','Valid standard UUID fixture owner accepted'],modelInferenceCalls:0,databaseRlsVerified:false,mode:'SIMULATED localhost HTTP session wiring only'};
writeFileSync('/private/tmp/tenops-tenbot-agent-poc/http-live-review-validation.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
