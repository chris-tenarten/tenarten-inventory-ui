/** Focused offline compatibility, caller authorization and canonical answer checks. */
import assert from 'node:assert/strict';
import {canonicalHistoryScope} from '../supabase/functions/_shared/tenbot-history-scope';
import {createTenbotAgentJobTools,createTenbotAgentKnowledgeTools,createTenbotAgentScopeTool} from '../supabase/functions/_shared/tenbot-agent-operations';
import {operationalReceipt,validOperationalReceipt,restoreOperationalHistory} from '../supabase/functions/_shared/tenbot-operational-history';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import {createTenbotAgentHistoryStore} from '../supabase/functions/_shared/tenbot-agent-history-store';
import type {AgentStep} from '../supabase/functions/_shared/tenbot-agent';

const checks:string[]=[],baseline='644df6bbb7eaf5fec678f6775fe7e5b55ef3de9e442b41730992e358a68d550d';
const digest=async(source:unknown)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({snapshot:'tenbot-agent-display-scope.v1',source})))).toString('hex');
const f=createContextFixture();
const scope=createTenbotAgentScopeTool([...createTenbotAgentJobTools(f.state.jobTools!).tools,...createTenbotAgentKnowledgeTools(async()=>true)]);
const current=(await scope.execute({},{callerId:f.owner,signal:new AbortController().signal})).data;
assert.notEqual(await digest(current),baseline);assert.equal(await digest(canonicalHistoryScope(current)),baseline);
const raw=JSON.stringify(current);canonicalHistoryScope(current);assert.equal(JSON.stringify(current),raw);
for(const change of ['name','kind','description','boundary'] as const){
 const value=structuredClone(current) as unknown as {capabilities:{name:string;kind:string;description:string}[];sql:boolean};
 if(change==='boundary')value.sql=true;else value.capabilities[0][change]+=' changed';
 assert.notEqual(await digest(canonicalHistoryScope(value)),baseline);
}
checks.push('Exact additive descriptor bridge preserves the accepted history digest; changed tool identity/kind/hard boundaries or unknown descriptions still invalidate it');

const run=()=>f.handler('https://tendev.pages.dev',{spendingAuthorized:false,persistentHistory:true});
const answer=await run()({action:'ask',question:'How many Jobs are currently in Production?'}) as {conversationId:string;message:string};
assert.equal(f.archives.get(answer.conversationId)![0].turn.scopeDigest,baseline);
const restored=await run()({action:'history',conversationId:answer.conversationId}) as {turns:{question:string;answer:{message:string}}[]};
assert(restored.turns.some(t=>t.answer.message===answer.message));
f.hidden.add(f.tables.jobs[0].id);const revoked=await run()({action:'history',conversationId:answer.conversationId}) as typeof restored;
assert(!JSON.stringify(revoked).includes(answer.message));assert(!JSON.stringify(revoked).includes('How many Jobs are currently in Production?'));f.hidden.clear();
checks.push('Existing owner-private scope remains readable after the additive capability update, while current record revocation still selectively redacts both question and answer');

const args={statuses:['on_hold'],include_archived:false},result=await f.state.jobTools!.execute('get_production_overview',args);
const receipt=await operationalReceipt([{name:'get_production_overview',args,result}],'How many On Hold Jobs?','Historical synthetic count',new Date(f.state.now).toISOString(),f.state.now,baseline);
assert(receipt&&validOperationalReceipt(receipt));assert((await restoreOperationalHistory([receipt],f.state.jobTools!,f.state.now,baseline,answer.conversationId,'assistant',async()=>true)).kept.length===1);
for(const statuses of [['invalid'],['on_hold','on_hold'],Array(8).fill('on_hold'),'on_hold',null]){const invalid=structuredClone(receipt);invalid.reads[0].args.statuses=statuses;assert(!validOperationalReceipt(invalid));}
checks.push('Legacy bounded receipts retain/revalidate native canonical status arguments and reject invalid, duplicate, oversized or non-array selectors');

const primary=createContextFixture();primary.tables.jobs[1].production_status='on_deck';let step=0;
const sessions=createTenbotAgentSessions({readOnlyHosted:true,mode:'openai',sessionStore:createTenbotAgentHistoryStore(primary.caller,primary.service,{persistent:true}),can:async()=>true,jobTools:()=>primary.state.jobTools!,now:()=>primary.state.now,
 provider:()=>({name:'OFFLINE tool transport',model:'no-inference',async step(){step++;const usage={inputTokens:0,cachedInputTokens:0,outputTokens:0,costUsd:0,reservedUsd:0};if(step===1)return{calls:[{id:'discover',name:'discover_capabilities',arguments:{names:['find_jobs']}}],continuation:[],usage};if(step===2)return{calls:[{id:'list',name:'find_jobs',arguments:{query:'On Deck',statuses:[],include_archived:true,limit:20,cursor:''}}],continuation:[],usage};return{calls:[],continuation:[],usage,final:{answer:'No Jobs can be listed.',observations:[{text:'No Jobs can be listed.',evidence_ids:['e1']}],inferences:[],recommendations:[],questions:[],completed_actions:[]}} as AgentStep;}})});
const listed=await sessions({action:'ask',question:'List On Deck Jobs'},primary.owner) as {conversationId:string;message:string};
assert(listed.message.includes('CTX-2 — Context Job 2 — On Deck'));assert(!listed.message.includes('CTX-1 —'));assert(!listed.message.includes('No Jobs'));
assert.deepEqual(primary.row(listed.conversationId).state.context?.selection.statuses,['on_deck']);assert.equal(primary.row(listed.conversationId).state.context?.selection.includeArchived,false);
checks.push('Standalone primary-selected enumeration uses the compiled employee population and canonical answer even when generated filter arguments/prose are wrong; no literal-question handler');
const unavailable=createContextFixture(),real=unavailable.state.jobTools!;let countStep=0;
unavailable.state.jobTools={...real,async execute(name,args){const value=await real.execute(name,args);return name==='get_production_overview'?{...value,status:'unavailable',complete:false,data:null,unknowns:['Synthetic count unavailable']}:value;}};
const counts=createTenbotAgentSessions({readOnlyHosted:true,mode:'openai',sessionStore:createTenbotAgentHistoryStore(unavailable.caller,unavailable.service,{persistent:true}),can:async()=>true,jobTools:()=>unavailable.state.jobTools!,now:()=>unavailable.state.now,
 provider:()=>({name:'OFFLINE failed count',model:'no-inference',async step(){countStep++;const usage={inputTokens:0,cachedInputTokens:0,outputTokens:0,costUsd:0,reservedUsd:0};if(countStep===1)return{calls:[{id:'discover',name:'discover_capabilities',arguments:{names:['get_production_overview']}}],continuation:[],usage};if(countStep===2)return{calls:[{id:'count',name:'get_production_overview',arguments:{statuses:[],include_archived:false,start_date:'',end_date:'',limit:20}}],continuation:[],usage};return{calls:[],continuation:[],usage,final:{answer:'There are 0 Jobs.',observations:[{text:'There are 0 Jobs.',evidence_ids:['e1']}],inferences:[],recommendations:[],questions:[],completed_actions:[]}} as AgentStep;}})});
const failed=await counts({action:'ask',question:'How many Jobs are On Deck?'},unavailable.owner) as {message:string};assert.match(failed.message,/unavailable|cannot establish/i);assert(!/\b0 Jobs\b/.test(failed.message));
checks.push('A failed overview cannot publish or archive generated false-zero prose, even when the same unavailable result repeats during freshness checks');
console.log(JSON.stringify({passed:true,groups:checks.length,checks,actualDatabase:false,actualInference:false,hostedRequests:0},null,2));
