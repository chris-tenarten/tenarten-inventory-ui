// Offline network doubles only. Never loads real credentials or makes API calls.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {createReceivalLiveProviders} from './support/tenbot-receival-provider.mjs';
import type {AgentStepRequest} from '../supabase/functions/_shared/tenbot-agent';

const groups:string[]=[];
async function test(name:string,run:()=>Promise<void>){await run();groups.push(name);}
const request=():AgentStepRequest=>({instructions:'Bounded synthetic invoice test.',history:[{kind:'user',content:'Read this synthetic invoice.'}],tools:[],finalSchema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},signal:AbortSignal.timeout(3000),maxOutputTokens:100,remainingUsd:.1,onReserve(){}});
const response=(patch:Record<string,unknown>={})=>new Response(JSON.stringify({model:'gpt-6.1-terra',service_tier:'default',status:'completed',usage:{input_tokens:20,output_tokens:5,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},total_tokens:25},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'{"ok":true}'}]}],...patch}),{status:200,headers:{'Content-Type':'application/json'}});
function setup(options:{authorized?:boolean;frozen?:boolean;baseline?:number;now?:number;fetcher?:typeof fetch}={}){
 const directory=mkdtempSync(tmpdir()+'/tenbot-receival-provider-offline-'),credentialFile=directory+'/credential.private',legacyJournal=directory+'/legacy.private.json';
 writeFileSync(credentialFile,'TENBOT_OPENAI_API_KEY=offline-server-only-key-placeholder\nTENBOT_OPENAI_SPEND_AUTHORIZED='+String(options.frozen===false)+'\n',{mode:0o600});
 writeFileSync(legacyJournal,JSON.stringify({reservedOrSpentUsd:options.baseline??.53995550,attempts:367,settled:367}),{mode:0o600});
 const before={credential:readFileSync(credentialFile,'utf8'),legacy:readFileSync(legacyJournal,'utf8')};
 let networkCalls=0;
 const fetcher:typeof fetch=options.fetcher??(async()=>{networkCalls++;return response();});
 const config={authorized:options.authorized??true,directory,credentialFile,legacyJournal,fetcher,now:()=>options.now??Date.parse('2026-10-30T14:00:00Z'),verifyGitIgnore:false};
 const provider=createReceivalLiveProviders(config);
 return {provider,directory,config,before,networkCalls:()=>networkCalls,preserved(){assert.equal(readFileSync(credentialFile,'utf8'),before.credential);assert.equal(readFileSync(legacyJournal,'utf8'),before.legacy);},ledger(){return JSON.parse(readFileSync(directory+'/inference-budget.json','utf8'));}};
}

await test('explicit authorization and finite expiry reject before any inference',async()=>{
 for(const options of [{authorized:false},{now:Date.parse('2026-10-30T23:00:00Z')}]){const h=setup(options);await assert.rejects(h.provider.createProvider('offline').step(request()),/spending-not-authorized/);assert.equal(h.networkCalls(),0);h.preserved();h.provider.close();}
});
await test('original localhost flag must stay frozen and hosted worst-case fits original five dollars',async()=>{
 for(const options of [{frozen:false},{baseline:.95}]){const h=setup(options);await assert.rejects(h.provider.createProvider('offline').step(request()));assert.equal(h.networkCalls(),0);h.preserved();h.provider.close();}
});
await test('actual returned usage settles the reserved amount and preserves both prior files',async()=>{
 const h=setup(),result=await h.provider.createProvider('offline').step(request());assert.equal(result.usage.costUsd,.000045);const ledger=h.ledger();assert.equal(ledger.attempts,1);assert.equal(ledger.settled,1);assert(Math.abs(ledger.reservedOrSpentUsd-.000045)<1e-9);assert(ledger.legacyLocalUsd+ledger.hostedMaximumUsd+ledger.authorizedMaximumUsd<=ledger.overallMaximumUsd);h.preserved();h.provider.close();
});
await test('persistent restart never resets settled spending',async()=>{
 const h=setup();await h.provider.createProvider('offline').step(request());h.provider.close();const restarted=createReceivalLiveProviders(h.config);await restarted.createProvider('offline-restart').step(request());const ledger=h.ledger();assert.equal(ledger.attempts,2);assert.equal(ledger.settled,2);assert(Math.abs(ledger.reservedOrSpentUsd-.00009)<1e-9);restarted.close();h.preserved();
});
await test('unknown provider outcomes retain their full reservation and block another dispatch',async()=>{
 let calls=0;const h=setup({fetcher:async()=>{calls++;return new Response('{"error":{"code":"offline_failure"}}',{status:500});}});await assert.rejects(h.provider.createProvider('offline-unknown').step(request()));const ledger=h.ledger();assert(ledger.reservedOrSpentUsd>0);assert.equal(ledger.attempts,1);assert.equal(ledger.settled,0);assert.equal(ledger.stopped,'unmeasured-charge-requires-review');await assert.rejects(h.provider.createProvider('offline-retry').step(request()));assert.equal(calls,1);h.provider.close();h.preserved();
});
await test('authorization/model HTTP failure stops immediately without another network request',async()=>{
 let calls=0;const h=setup({fetcher:async()=>{calls++;return new Response('{"error":{"code":"offline_access_denied"}}',{status:403});}});await assert.rejects(h.provider.createProvider('offline-denied').step(request()));assert.equal(h.ledger().stopped,'provider-http-403');await assert.rejects(h.provider.createProvider('offline-second').step(request()));assert.equal(calls,1);h.provider.close();
});
await test('wrong provider model/tier metadata retains uncertain charge and fails closed',async()=>{
 let calls=0;const h=setup({fetcher:async()=>{calls++;return response({service_tier:'priority'});}});await assert.rejects(h.provider.createProvider('offline-tier').step(request()),/unexpected-provider-metadata/);assert.equal(h.ledger().settled,0);await assert.rejects(h.provider.createProvider('offline-retry').step(request()));assert.equal(calls,1);h.provider.close();
});
await test('image tokens are counted before reserving or sending genuine generation input',async()=>{
 const image={bytes:await sharp({create:{width:32,height:32,channels:3,background:'#fff'}}).png().toBuffer(),mediaType:'image/png' as const};let calls=0;let directory='';
 const h=setup({fetcher:async(url,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.equal(body.model,'gpt-6.1-terra');assert(Array.isArray(body.input.at(-1).content));assert(body.input.at(-1).content.some((part:Record<string,unknown>)=>part.type==='input_image'));if(String(url).endsWith('/input_tokens')){assert.equal(JSON.parse(readFileSync(directory+'/inference-budget.json','utf8')).attempts,0);return new Response(JSON.stringify({object:'response.input_tokens',input_tokens:2000}));}assert.equal(body.service_tier,'default');assert.equal(body.store,false);assert.equal(JSON.parse(readFileSync(directory+'/inference-budget.json','utf8')).attempts,1);return response();}});directory=h.directory;
 await h.provider.createProvider('offline-image',image).step(request());assert.equal(calls,2);assert.equal(h.ledger().settled,1);assert(h.provider.getReceipts()[0].reservedUsd as number>.0025);const receipts=readFileSync(directory+'/inference-receipts.private.json','utf8');assert(!receipts.includes(image.bytes.toString('base64')));assert(!receipts.includes('offline-server-only-key-placeholder'));h.provider.close();h.preserved();
});
await test('failed image count never dispatches chargeable model generation',async()=>{
 const image={bytes:await sharp({create:{width:32,height:32,channels:3,background:'#fff'}}).png().toBuffer(),mediaType:'image/png' as const};let calls=0;
 const h=setup({fetcher:async url=>{calls++;assert(String(url).endsWith('/input_tokens'));return new Response('{}',{status:403});}});await assert.rejects(h.provider.createProvider('offline-count-denied',image).step(request()));assert.equal(calls,1);assert.equal(h.ledger().attempts,0);assert.equal(h.ledger().reservedOrSpentUsd,0);await assert.rejects(h.provider.createProvider('offline-count-second',image).step(request()));assert.equal(calls,1);h.provider.close();
});
await test('a request that cannot fit the ten-cent authorization cannot dispatch',async()=>{
 const h=setup();await assert.rejects(h.provider.createProvider('offline-over-budget').step({...request(),instructions:'x'.repeat(85000),maxOutputTokens:3000}));assert.equal(h.networkCalls(),0);assert.equal(h.ledger().attempts,0);assert.equal(h.ledger().reservedOrSpentUsd,0);h.provider.close();
});
console.log(JSON.stringify({passed:true,groupsPassed:groups.length,groups,mode:'OFFLINE fetch doubles / disposable accounting only',inferenceCalls:0,realCredentialReads:0,hostedMutations:0}));
