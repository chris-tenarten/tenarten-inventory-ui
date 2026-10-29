/** Explicit opt-in: actual Terra; synthetic records/persistence; existing $5 ledger. */
import assert from 'node:assert/strict';
import {lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import {createTenbotAgentHistoryStore} from '../supabase/functions/_shared/tenbot-agent-history-store';
import {createHostedTenbotFixture} from './support/tenbot-hosted-fixture.mjs';
import {createMeasuredProvider,getJournal,getNetworkReceipts,closeBudget} from './support/tenbot-live-provider.mjs';
if(!process.argv.includes('--authorized-live'))throw Error('Explicit --authorized-live and the existing capped credential environment are required.');
const stat=lstatSync('.env.tenbot.local');
assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid?.()&&(stat.mode&0o077)===0,'Owned server-only secret file required');
const dir='/private/tmp/tenops-tenbot-hosted-adapter-20261029',f=createHostedTenbotFixture();mkdirSync(dir,{recursive:true});
const before=getJournal(),rows:unknown[]=[];
try{
 const session=()=>createTenbotAgentSessions({can:async(_owner,cap)=>{const r=await f.caller('has_app_capability',{p_capability:cap});return r.data===true;},jobTools:()=>({async execute(){throw Error('Live operational records unavailable in this synthetic fixture');}}),provider:()=>createMeasuredProvider('gpt-6.1-terra','hosted-readonly-release'),mode:'openai',readOnlyHosted:true,sessionStore:createTenbotAgentHistoryStore(f.caller,f.service)});
 let conversationId:string|undefined;
 for(const question of ['Walk me through creating a group conversation in TenOps, one step at a time.','I have opened New group. What do I do next?']){
  const start=performance.now(),answer=await session()({action:'ask',question,...(conversationId?{conversationId}:{})},f.owner) as {conversationId:string;mode:string;contentScope:string;message:string};
  assert.equal(answer.mode,'assistant');assert.equal(answer.contentScope,'workflow');conversationId=answer.conversationId;
  rows.push({question,answer,latencyMs:Math.round(performance.now()-start)});
 }
 const count=getNetworkReceipts().length;
 const history=await session()({action:'history',conversationId},f.owner) as {turns:unknown[]};assert.equal(history.turns.length,2);assert.equal(getNetworkReceipts().length,count);
 const after=getJournal(),receipts=getNetworkReceipts().map(row=>({model:row.model,apiModel:row.apiModel,httpStatus:row.httpStatus,serviceTier:row.serviceTier,durationMs:row.durationMs,calls:row.calls,usage:row.usage,accountedUsd:row.accountedUsd}));
 const report={passed:true,actualInference:true,actualDatabase:false,mode:'Real Terra read-only session, synthetic RPC storage; not hosted/JWT/RLS certification',rows,receipts,restoredTurns:history.turns.length,restorationInferenceCalls:0,before,after,addedCalls:after.attempts-before.attempts,addedAccountedUsd:after.reservedOrSpentUsd-before.reservedOrSpentUsd};
 writeFileSync(dir+'/live.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({passed:true,actualInference:true,actualDatabase:false,addedCalls:report.addedCalls,addedAccountedUsd:report.addedAccountedUsd,restoredTurns:2}));
}catch(error){writeFileSync(dir+'/live-failure.json',JSON.stringify({passed:false,kind:error instanceof Error?error.name:'unknown',journal:getJournal(),completedTurns:rows.length})+'\n',{mode:0o600});throw Error('Live read-only validation stopped; inspect local sanitized failure receipt.');}
finally{closeBudget();}
