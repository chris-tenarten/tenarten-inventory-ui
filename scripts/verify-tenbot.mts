import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {pilotDirectory} from './support/tenbot-ai-pilot.mjs';
import {answer,resolveInput,cloudflareProvider,groundedProse,requiredInferencePermissions,type InferenceInput,type InferenceProvider} from '../supabase/functions/_shared/tenbot-core';
import {retrieve,registry,snapshot,conversationGuides,knowledgeEntries,knowledgeSnapshot,hasGuidePermission} from '../supabase/functions/_shared/tenbot-knowledge';
import {generatedKnowledge} from '../supabase/functions/_shared/tenbot-knowledge-snapshot';
import {workflowSupplement,workflowSupplementSnapshot,workflowSupplementSources} from '../supabase/functions/_shared/tenbot-workflow-supplement';
import {handleTenbot as actualHandleTenbot} from '../supabase/functions/_shared/tenbot-handler';
// These pre-existing unit cases isolate capability/metering behavior. Actual
// owner history and SQL enforcement are tested by verify-tenbot-privacy.mts.
const handleTenbot=(...args:Parameters<typeof actualHandleTenbot>)=>{
 const caller=args[2],service=args[3];
 args[3]=async(name,values)=>name==='tenbot_append_conversation_turn'?{data:true,error:null}:service(name,values);
 args[2]=async(name,values)=>name==='tenbot_load_conversation'?{data:{ok:true,id:'00000000-0000-4000-8000-000000000777',ownerId:args[1],version:0,turns:[]},error:null}:name==='tenbot_append_conversation_turn'?{data:true,error:null}:caller(name,values);
 return actualHandleTenbot(...args);
};
import {projectConversation} from '../supabase/functions/_shared/tenbot-privacy';
import {startIntakeDatabase,sql,docker,asUser,literal,json,admin,member} from './support/intake-materials-database.mjs';

const all=new Set([...registry,...knowledgeEntries].flatMap(entry=>[entry.permission,...entry.additionalPermissions||[]]));
all.add('readOperationalData');
const readOnly=new Set(['readOperationalData']);
let reserved=0;
const reserve=async()=>{reserved++;};
const fixture=(output:unknown,inspect?:(input:InferenceInput)=>void):InferenceProvider=>({name:'local deterministic fixture',infer:async input=>{inspect?.(input);return output;}});
const noInference:InferenceProvider={name:'must remain local',infer:async()=>{throw Error('Unexpected external inference');}};
const groupQuestion='How do I create a group conversation?';
const manpowerQuestion='how do i filter by jobs in manpower reporting';
const reworkQuestion='how do i initiate a rework for a job?';
const customerEditQuestion='how do i edit a saved customers details';
const entry=(id:string)=>{const found=registry.find(candidate=>candidate.id===id);assert(found,id);return found;};
for(const action of ['delete','remove','export','import','predict','forecast','automate','sync','train','invite','approve']){
 assert.match(projectConversation(`How do I ${action} a group conversation?`,[]).question,new RegExp(`\\b${action}\\b`),'Unsupported action intent must survive privacy filtering');
}

// The generated corpus is an export of the reviewed deployed source boundary,
// not whichever files happen to be present in dev. It supplies broader AI
// context without relaxing direct-search matching or permission decisions.
execFileSync(process.execPath,['scripts/generate-tenbot-knowledge.mjs','--check'],{stdio:'pipe'});
assert.equal(knowledgeSnapshot.revision,'bc628bdafea374f6a5fd446d7e924ff9d65918bf');
assert.equal(knowledgeSnapshot.entryCount,knowledgeEntries.length);
assert.equal(new Set(knowledgeEntries.map(item=>item.id)).size,knowledgeEntries.length);
const generatedSources=new Map(generatedKnowledge.flatMap(item=>item.provenance).map(source=>[source.path,source]));
assert.equal(generatedSources.size,knowledgeSnapshot.sourceCount);
for(const source of generatedSources.values()){
 assert.equal(source.revision,knowledgeSnapshot.revision);
 assert.equal(execFileSync('git',['rev-parse',`${source.revision}:${source.path}`],{encoding:'utf8'}).trim(),source.blob);
 const bytes=execFileSync('git',['show',`${source.revision}:${source.path}`]);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
}
// Selective external-package integration remains pinned and server-owned;
// broad package permission projections cannot replace action-specific gates.
assert.equal(workflowSupplementSnapshot.packageSha256,'63c356867c92eaac60256610b90cf177afa77629b595c94099a3b885e62522c4');
assert.equal(workflowSupplementSnapshot.revision,knowledgeSnapshot.revision);
assert.equal(workflowSupplement.length,workflowSupplementSnapshot.entryCount);
assert.equal(workflowSupplementSources.length,workflowSupplementSnapshot.sourceCount);
assert.equal(new Set(registry.map(source=>source.id)).size,registry.length);
const reconciliation=JSON.parse(readFileSync('scripts/tenbot-knowledge/external-reconciliation.json','utf8')) as {
 packageSha256:string;runtimeRevision:string;recordCount:number;
 records:{id:string;disposition:string;targets:string[];reason:string}[];
};
assert.equal(reconciliation.packageSha256,workflowSupplementSnapshot.packageSha256);
assert.equal(reconciliation.runtimeRevision,knowledgeSnapshot.revision);
assert.equal(reconciliation.recordCount,96);assert.equal(reconciliation.records.length,96);
assert.equal(new Set(reconciliation.records.map(record=>record.id)).size,96);
const allSourceIds=new Set([...registry,...knowledgeEntries].map(source=>source.id));
for(const record of reconciliation.records){
 assert(['existing','supplemented','deferred','rejected'].includes(record.disposition),record.id);
 assert(record.reason.trim());
 for(const target of record.targets)assert(allSourceIds.has(target),target);
 if(record.disposition==='supplemented')assert.deepEqual(record.targets,workflowSupplement.filter(source=>source.externalRecordIds.includes(record.id)).map(source=>source.id));
}
for(const id of ['tasks-recurrence-unavailable','releases-communications'])assert.equal(reconciliation.records.find(record=>record.id===id)?.disposition,'rejected');
const supplementalPaths=new Set(workflowSupplementSources.map(source=>source.path));
for(const source of workflowSupplementSources){
 assert.equal(source.revision,knowledgeSnapshot.revision);
 assert.equal(execFileSync('git',['rev-parse',`${source.revision}:${source.path}`],{encoding:'utf8'}).trim(),source.blob);
 assert.equal(createHash('sha256').update(execFileSync('git',['show',`${source.revision}:${source.path}`])).digest('hex'),source.sha256);
}
for(const source of workflowSupplement){
 assert(source.guidance.length<=1600,source.id);
 assert(source.externalRecordIds.length>0);
 for(const path of source.sourceFiles)assert(supplementalPaths.has(path),path);
 assert.doesNotMatch(source.guidance,/NEXT_PUBLIC_|service_role|Bearer|https?:|\b[a-f0-9]{40,64}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
 for(const permission of [source.permission,...source.additionalPermissions||[]]){
  assert(!hasGuidePermission(source,new Set([...all].filter(value=>value!==permission))),`${source.id}: ${permission}`);
 }
}
const supplement=(id:string)=>{const source=workflowSupplement.find(source=>source.id===id);assert(source,id);return source;};
const withoutSchedule=new Set([...all].filter(permission=>permission!=='scheduleProduction'));
assert(hasGuidePermission(supplement('workflow-intake-convert'),withoutSchedule),'Plan Later conversion does not require scheduling');
assert(!supplement('workflow-historical-import').additionalPermissions?.includes('production_blend.manage'));
assert(supplement('workflow-historical-verify').additionalPermissions?.includes('production_blend.manage'));
assert(supplement('workflow-po-receivals').additionalPermissions?.includes('adjustInventory'));
assert.match(supplement('workflow-sample-versions').path,/Formula checkpoints and previews/);
assert.match(supplement('workflow-intake-bid').guidance,/Save Bid/);
for(const [question,module] of [
 ['How do I record a Material Usage report?','material-usage'],
 ['How do I create a Letter of Transmittal?','transmittals'],
 ['How do I search the material Catalog?','catalog'],
] as const){
 assert(conversationGuides(question).length>0);
 for(const source of conversationGuides(question))assert(source.modules.includes(module),`${question}: ${source.id}`);
}
for(const question of ['How do I export Material Usage to payroll?','How do I train the Catalog?','How do I sync a Transmittal to Salesforce?'])assert.deepEqual(retrieve(question,all),[],question);
for(const source of knowledgeEntries){
 assert.equal(source.status,'deployed');assert(source.guidance.length<=3000);
 assert.doesNotMatch(source.guidance,/production_rework_cycles|scope_details|original:<job|rework:<|NEXT_PUBLIC_|service_role|Bearer|https?:|\b[a-f0-9]{40,64}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
}
const generatedEntry=(id:string)=>{const found=knowledgeEntries.find(source=>source.id===id);assert(found,id);return found;};
const productionSource=generatedEntry('knowledge-production');
assert.match(productionSource.guidance,/Phase and Item Planning is not enabled/);
assert.doesNotMatch(productionSource.guidance.split('Static source interface text')[1]||'',/Planning Phase|Planning schedule pending|Planning changes/);
const blendSource=generatedEntry('knowledge-blend');
assert(hasGuidePermission(blendSource,all));
for(const missing of ['readOperationalData','writeBusinessData','production_blend.manage']){
 assert(!hasGuidePermission(blendSource,new Set([...all].filter(permission=>permission!==missing))),missing);
}
assert.doesNotMatch(generatedEntry('knowledge-samples').guidance,/Plan Production Blend →|PRINT COLOR PLATE LABEL|Production Batch basis/);
assert.match(generatedEntry('knowledge-intake-timeline').guidance,/does not reserve Production capacity/);
assert.match(generatedEntry('knowledge-timeline').guidance,/Staging does not save/);
assert.match(generatedEntry('knowledge-purchasing').guidance,/PDF failure does not undo issuance/);
assert.match(generatedEntry('knowledge-purchasing').guidance,/Pending Receivals creation is explicit after permanent PDF generation/);
assert.match(generatedEntry('knowledge-material-assessment').guidance,/does not mount a material-assessment editor/);
assert.equal(generatedEntry('knowledge-material-assessment').availability,'partial');

// Broader employee questions are answered using extracted knowledge, while
// direct fallback stays an honest documentation gap. No model/network is used.
for(const [question,id,prose] of [
 ['What happens if the Purchase Order PDF fails after issuing?','knowledge-purchasing','PDF failure does not undo Purchase Order issuance. The issued record keeps its status so generation can be retried.'],
 ['How does purchasing become pending receivals?','knowledge-purchasing','Pending Receivals creation is explicit after the permanent Purchase Order PDF is generated. Incoming material becomes on-hand Inventory only after receiving.'],
] as const){
 const supplementalMatch=retrieve(question,all)[0];
 if(question.includes('pending receivals'))assert.equal(supplementalMatch?.id,'workflow-po-receivals');
 else assert.equal(supplementalMatch,undefined);
 const fallback=await answer({action:'ask',question},all,null,reserve);
 if(supplementalMatch){assert.equal(fallback.mode,'guide');assert.equal(fallback.sources[0]?.id,supplementalMatch.id);}
 else{assert.equal(fallback.mode,'verified');assert.equal(fallback.resolution,'documentation-missing');assert.deepEqual(fallback.sources,[]);}
 assert(conversationGuides(question).some(source=>source.id===id));
 const ai=await answer({action:'ask',question},all,fixture({ids:[id],answer:prose},input=>{
  assert(input.excerpts.some(source=>source.id===id));assert(input.excerpts.length<=4);
  assert(input.excerpts.reduce((size,source)=>size+source.guidance.length,0)<=8000);
  assert(!JSON.stringify(input).includes(knowledgeSnapshot.revision));
  assert(!JSON.stringify(input).includes('src/modules/'));
 }),reserve);
 assert.equal(ai.mode,'ai');assert.equal(ai.message,prose);assert.equal(ai.sources[0]?.id,id);
}
for(const question of ['How does Calendar payroll export work?','How do I tune the CNC machine?']){
 assert.deepEqual(conversationGuides(question),[],question);
}
const sampleBidSource=entry('sample-bid');
assert.equal(sampleBidSource.status,'deployed');assert.match(sampleBidSource.guidance,/Existing standalone Sample, then Link Sample/);
assert.match(sampleBidSource.guidance,/already linked to another Bid cannot/);
assert.match(sampleBidSource.guidance,/Existing generated documents are not changed/);
assert.equal(entry('material-lead').availability,'partial');
assert.match(entry('material-lead').guidance,/does not automatically predict supplier delivery/);

// Module aliases must constrain broader generated retrieval as firmly as
// explicit module names. A shared PDF or Bid token cannot substitute a source.
for(const source of conversationGuides('What happens if the Purchase Order PDF fails after issuing?'))assert(source.modules.includes('purchasing'),source.id);
assert.equal(conversationGuides('What can I do with a Bid?')[0]?.id,'knowledge-intake');
assert(conversationGuides('How do I attach a Sample to a Bid?').some(source=>source.id==='knowledge-sample-bid'));
assert.equal(entry('share-job').status,'unknown');
assert.match(entry('share-job').guidance,/cannot verify a native Share Job control or Job card/);
assert.match(entry('share-job').guidance,/ordinary text and attachments/i);
assert.match(entry('share-job').guidance,/Creating a group by itself does not share a Job/);
assert.match(entry('material-lead').guidance,/^The current Bid Inspector does not expose/);
assert.match(entry('material-lead').guidance,/cannot verify another employee-facing estimator/);
for(const source of [...registry,...knowledgeEntries])assert.doesNotMatch(source.guidance,/has_proposal_access|editProductionJobDetails|production_blend\.manage|writeBusinessData|readOperationalData/);

// A broad read source may mention a mutation control without authorizing the
// requesting employee to use it. Server RPC decisions remain authoritative.
assert(requiredInferencePermissions([productionSource]).includes('writeBusinessData'));
assert(!requiredInferencePermissions([productionSource]).includes('adjustInventory'));
assert(requiredInferencePermissions([generatedEntry('knowledge-samples')]).includes('production_blend.manage'));
assert(requiredInferencePermissions([generatedEntry('knowledge-intake')]).includes('createProductionJob'));
for(const [question,permissions,id,prose] of [
 ['What does the Production Pipeline do?',readOnly,'knowledge-production','Create a new Job from Production.'],
 ['What does the Production Pipeline do?',readOnly,'knowledge-production','You can create a Job in Production.'],
 ['What does the Production Pipeline do?',readOnly,'knowledge-production','Go to New Job in Production.'],
 ['How do I plan a Production Blend?',new Set(['readOperationalData','writeBusinessData']),'knowledge-samples','You can generate a Blend Sheet.'],
 ['What does Inventory show?',readOnly,'knowledge-inventory','You can receive Inventory.'],
 ['What does Inventory show?',new Set(['readOperationalData','writeBusinessData']),'knowledge-inventory','Adjust the Inventory quantity.'],
 ['How do I find customer Jobs?',new Set(['readOperationalData','writeBusinessData']),'customer-history','You can edit customer details.'],
 ['How does Intake work?',new Set([...all].filter(permission=>permission!=='createProductionJob')),'knowledge-intake','You can convert the Bid to Production.'],
 ['How does Intake work?',new Set([...all].filter(permission=>permission!=='scheduleProduction')),'knowledge-intake','Carry projected dates to Production.'],
] as const){
 await assert.rejects(answer({action:'ask',question},permissions,fixture({ids:[id],answer:prose}),reserve),/permission wording|verify|wording/i,prose);
}
const restrictedBlend=await answer({action:'ask',question:'How do I plan a Production Blend?'},new Set(['readOperationalData','writeBusinessData']),fixture({ids:['knowledge-samples'],answer:'Your account cannot generate a Blend Sheet. An administrator can review your access.'}),reserve);
assert.equal(restrictedBlend.mode,'ai');assert.match(restrictedBlend.message,/cannot generate/);
for(const prose of ['Open the Planning tab.','Select Planning phases.','Open Settings → Phase Library.','Create a Planning Item.','You can add a Planning Phase.','Although Planning is not enabled, open the Planning tab.']){
 await assert.rejects(answer({action:'ask',question:'How are Planning and Timeline different?'},all,fixture({ids:['knowledge-intake-timeline','knowledge-timeline'],answer:prose}),reserve),/deployed workflow wording|verify|wording/i,prose);
}
for(const prose of ['You can open Phase and Item Planning to schedule a Job.','You can open Phase/Item Planning to schedule a Job.','You can open Phase-Item Planning to schedule a Job.']){
 await assert.rejects(answer({action:'ask',question:'What does the Production Pipeline do?'},all,fixture({ids:['knowledge-production'],answer:prose}),reserve),/deployed workflow wording|verify|wording/i,prose);
}
const readonlyCalls:string[]=[];
await assert.rejects(handleTenbot({action:'ask',question:'What does the Production Pipeline do?',permissions:[...all]},admin,async(name,args)=>{
 assert.equal(name,'has_app_capability');readonlyCalls.push(String(args?.p_capability));
 return {data:args?.p_capability==='readOperationalData',error:null};
},async(name)=>({data:name==='tenbot_reserve_usage'?'fixture-reservation':null,error:null}),{
 ...fixture({ids:['knowledge-production'],answer:'You can create a Job in Production.'}),
 reserveEstimate:()=>({model:'@cf/meta/llama-3.1-8b-instruct-fp8',neurons:1}),
}),/permission wording/i);
assert(readonlyCalls.includes('writeBusinessData'),'Read-source claims need the actual server mutation capability check');
assert(!readonlyCalls.includes('adjustInventory'),'Unrelated mutation gates should not be queried');

// Every maintained example must retrieve its actual workflow first and remain
// usable through direct guide search when the provider is absent.
const beforeCorpus:number=reserved;
let corpusCases=0;
for(const expected of registry){
 assert.ok(readFileSync(expected.evidence.split('#')[0]));
 if(expected.route)assert.ok(readFileSync('src/app'+expected.route+'/page.tsx'));
 if(expected.status!=='deployed')assert.equal(expected.route,null);
 for(const sourceFile of expected.sourceFiles){
  assert.ok(readFileSync(sourceFile));
  execFileSync('git',['cat-file','-e',`${snapshot.revision}:${sourceFile}`],{stdio:'pipe'});
 }
 for(const question of expected.examples){
  assert.equal(retrieve(question,all)[0]?.id,expected.id,question);
  const fallback=await answer({action:'ask',question},all,null,reserve);
  assert.equal(fallback.sources[0]?.id,expected.id,`direct guide fallback: ${question}`);
  assert.equal(fallback.sources[0].guidance,expected.guidance);
  assert.equal('receipt' in fallback.snapshot,false);
  if(expected.availability==='unavailable')assert.equal(fallback.resolution,'unavailable');
  else if(expected.status==='unknown')assert.equal(fallback.resolution,'documentation-missing');
  else if(expected.status==='local'||expected.status==='planned')assert.equal(fallback.resolution,'unavailable');
  corpusCases++;
 }
}
assert(corpusCases>=89,`Expected the maintained 89-question coverage corpus, received ${corpusCases}`);
assert.equal(reserved,beforeCorpus,'Direct guide coverage must consume no inference budget');
for(const [question,id] of [[reworkQuestion,'production-rework-create'],[manpowerQuestion,'manpower-job-filter'],[customerEditQuestion,'customer-edit']] as const){
 assert.equal(retrieve(question,all)[0]?.id,id,question);
 const result=await answer({action:'ask',question},all,null,reserve);
 assert.equal(result.resolution,'available');assert.equal(result.sources[0].id,id);
}
assert.match(entry('production-rework-create').guidance,/completed|complete/);
assert.match(entry('production-rework-create').guidance,/same canonical Job/);
assert.match(entry('manpower-job-filter').guidance,/Job labor review/);
assert.match(entry('customer-edit').guidance,/Customer Inspector/);
assert.match(entry('customer-edit').guidance,/Existing Jobs and Proposals keep their captured information/);

// Unknown module actions must never substitute a guide merely sharing Jobs,
// customers, or a generic action. Unknown does not imply an absent feature.
const unknownQuestions=[
 'How do I filter existing Jobs?',
 'How do I filter Jobs in Inventory?',
 'How do I export payroll in Manpower Reporting?',
 'How do I delete a customer in Contacts?',
 'How do I train a model in Samples?',
 'How do I approve a group conversation?',
 'How do I use telepathy in Manpower Reporting?',
];
for(const question of unknownQuestions){
 assert.deepEqual(retrieve(question,all),[],question);
 const before:number=reserved;
 const result=await answer({action:'ask',question},all,null,reserve);
 assert.equal(result.resolution,'documentation-missing',question);
 assert.deepEqual(result.sources,[]);assert.match(result.message,/verified|confirm|documentation/i);
 assert.doesNotMatch(result.message,/draft|suggestion|feature request/i);
 assert.equal(reserved,before);
 const clarified=await answer({action:'ask',question},all,fixture({ids:[],answer:'I cannot confirm that workflow from these sources. Which part of the module are you trying to use?'}),reserve);
 assert.equal(clarified.resolution,'documentation-missing',question);
 assert.deepEqual(clarified.sources,[]);assert.match(clarified.message,/cannot confirm/);
 assert.equal(clarified.suggestionAllowed,false);
}
for(const question of ['How do I update a Job?','How do I change my email address?','How do I find saved customers Jobs?']){
 assert(!retrieve(question,all).some(candidate=>candidate.id==='customer-edit'),question);
}
const crossModule=await answer({action:'ask',question:groupQuestion,context:['Current module: My Work']},all,null,reserve);
assert.equal(crossModule.sources[0].id,'group','Route context must not prevent explicit cross-module questions');

// Permission denial is deterministic, does not consume budget and supplies no
// restricted instructions. The exact Contacts conjunction remains enforced.
for(const id of ['customer-edit','production-rework-create','manpower-job-filter','sample-save','proposal-create','my-work-create','message-reply']){
 const workflow=entry(id);
 for(const missing of [workflow.permission,...workflow.additionalPermissions||[]]){
  const permissions=new Set([...all].filter(permission=>permission!==missing));
  assert(!retrieve(workflow.examples[0],permissions).some(candidate=>candidate.id===id));
  for(const provider of [null,noInference]){
   const before:number=reserved;
   const denied=await answer({action:'ask',question:workflow.examples[0]},permissions,provider,reserve);
   assert.equal(denied.resolution,'permission-denied',`${id}: ${missing}`);
   assert.deepEqual(denied.sources,[]);assert.match(denied.message,/permission|access/i);
   assert.doesNotMatch(denied.message,/Save Changes|Customer Inspector|feature request|suggestion/i);
   assert.equal(reserved,before);
  }
 }
}
for(const question of [reworkQuestion,manpowerQuestion,customerEditQuestion]){
 assert.equal((await answer({action:'ask',question},readOnly,noInference,reserve)).resolution,'permission-denied');
}
for(const id of ['planning-phase','planning-items']){
 const before:number=reserved;
 const result=await answer({action:'ask',question:entry(id).examples[0]},all,noInference,reserve);
 assert.equal(result.resolution,'unavailable');assert.equal(result.sources[0]?.availability,'unavailable');
 assert.equal(result.sources[0]?.route,null);assert.equal(reserved,before);
}
// A related permitted read guide must not authorize prose instructions for a
// denied edit workflow. The model receives only a safe existence/denial notice.
await assert.rejects(answer({action:'ask',question:"How do I edit customer details, and find a customer's previous Jobs?"},readOnly,fixture({ids:['customer-history'],answer:'Update the customer details, then save.'},input=>{
 const denied=input.excerpts.find(source=>source.id==='customer-edit');assert(denied);
 assert.match(denied.guidance,/permission denied/i);
 assert.doesNotMatch(denied.guidance,/Customer Inspector|Save Changes|Additional Information/);
 assert(input.excerpts.some(source=>source.id==='customer-history'));
}),reserve),/permission wording|verify|wording/i);

// Only existing server RPC decisions grant Proposal access; client claims and
// made-up app-capability aliases must have no effect.
for(const [proposalAccess,writable] of [[true,true],[false,true],[true,false]] as const){
 const calls:{name:string;permission?:string}[]=[];
 const result=await handleTenbot({action:'ask',question:'How do I create a Proposal?',permissions:[...all]},admin,async(name,args)=>{
  calls.push({name,permission:args?.p_capability as string|undefined});
  if(name==='has_proposal_access')return {data:proposalAccess,error:null};
  assert.equal(name,'has_app_capability');assert.notEqual(args?.p_capability,'proposal.access');
  return {data:args?.p_capability!=='writeBusinessData'||writable,error:null};
 },async()=>{throw Error('No provider means no reservation');},null,.2);
 assert(calls.some(call=>call.name==='has_proposal_access'));
 assert(calls.some(call=>call.permission==='writeBusinessData'));
 assert.equal((result as Awaited<ReturnType<typeof answer>>).resolution,proposalAccess&&writable?'available':'permission-denied');
}
const permissionChecks:string[]=[];
const deniedHandler=await handleTenbot({action:'ask',question:customerEditQuestion,permissions:[...all]},admin,async(name,args)=>{
 assert.equal(name,'has_app_capability');const permission=String(args?.p_capability);permissionChecks.push(permission);return {data:permission!=='writeBusinessData',error:null};
},async()=>{throw Error('Denied handler must not reserve');},null,.2);
assert.equal((deniedHandler as Awaited<ReturnType<typeof answer>>).resolution,'permission-denied');
assert(permissionChecks.includes('writeBusinessData')&&permissionChecks.includes('editProductionJobDetails'));
assert(!permissionChecks.includes('proposal.access'));

// Actual filtered wording and this account's bounded assistant dialogue reach
// the provider. They are not replaced with a canned guide title.
const prose='You can start the conversation right from Messaging. Choose New group, give it a name, select another participant, and then choose Create group.';
const conversationalQuestion='How do I create a group conversation? Explain the steps, please.';
const spoken=await answer({action:'ask',question:conversationalQuestion,context:['Current module: My Work']},all,fixture({ids:['group'],answer:prose,summary:''},input=>{
 assert.match(input.question,/how do i create a group conversation/i);
 assert.match(input.question,/explain the steps, please/i);
 assert.notEqual(input.question,entry('group').title);assert.deepEqual(input.context,['Current module: My Work']);
 assert(input.excerpts.some(source=>source.id==='group'));assert(input.excerpts.length<=4);
}),reserve);
assert.equal(spoken.message,prose);assert.equal(spoken.sources[0].availability,'available');
assert(spoken.sources[0].constraints.some(rule=>rule.startsWith('Only the creator')));

const multiQuestion='How do I initiate Rework for a Job, and filter by Jobs in Manpower Reporting?';
const multiProse='For Rework, open the completed Job in Production and choose Create Rework. For labor, open Manpower Reporting and choose the Job in Job labor review. These are separate workflows on the same Job.';
const multi=await answer({action:'ask',question:multiQuestion},all,fixture({ids:['production-rework-create','manpower-job-filter'],answer:multiProse},input=>{
 assert.match(input.question,/rework/i);assert.match(input.question,/manpower reporting/i);
 assert(input.excerpts.some(source=>source.id==='production-rework-create'));
 assert(input.excerpts.some(source=>source.id==='manpower-job-filter'));
 assert(input.excerpts.length<=4);
}),reserve);
assert.equal(multi.message,multiProse);
for(const id of ['production-rework-create','manpower-job-filter'])assert(multi.sources.some(source=>source.id===id));
const ownExchange='Conversation context:\nEmployee: How do I initiate Rework for a Job?\nTenBot: Open the completed Job in Production and choose Create Rework.';
assert(conversationGuides('What if I do not see that button?',['Current module: Production',ownExchange]).some(candidate=>candidate.id==='production-rework-create'));
const followup=await answer({action:'ask',question:'What if I do not see that button?',context:['Current module: Production']},all,fixture({ids:['production-rework-create'],answer:'Check that the Job is complete, unarchived, and has no active Rework cycle. If those conditions are met, ask an administrator to review your access.'},input=>{
 assert.equal(input.question,'What if I do not see that button?');
 assert(input.context.some(text=>text.startsWith('Conversation context:\nEmployee: How do I initiate Rework')));
 assert(input.excerpts.some(source=>source.id==='production-rework-create'));
}),reserve,[ownExchange]);
assert.match(followup.message,/unarchived/);
// Dependent questions keep the active workflow ahead of generic Job/date
// keywords; standalone requests can still move to another workflow.
for(const question of [
 'Can I do that before the Job is complete?',
 'Can I do that before the planned finish date?',
 'Can I do that with a planned Job?',
 'What about the dates?',
]){
 const resolved=resolveInput({action:'ask',question},[ownExchange]);
 assert.equal(resolved.directEntries[0]?.id,'production-rework-create',question);
 assert(resolved.entries.length>0&&resolved.entries.every(source=>source.modules.includes('rework')),question);
 const fallback=await answer({action:'ask',question},all,null,reserve,[ownExchange]);
 assert.equal(fallback.sources[0]?.id,'production-rework-create');
 assert.match(fallback.sources[0].guidance,/Job must be complete/);
 assert(!fallback.sources.some(source=>source.id==='production-schedule'));
}
const eligibilityQuestion='Can I do that before the Job is complete?';
const eligibilityProse='No. Rework requires the Job to be complete, unarchived, and have no active Rework cycle. You cannot initiate Rework before the Job is complete.';
const eligibility=await answer({action:'ask',question:'Can I do that before the planned finish date?'},all,fixture({ids:['production-rework-create'],answer:eligibilityProse},input=>{
 assert.equal(input.question,'Can I do that before the planned finish date?','The model receives the actual question, not a rewritten prompt');
 assert.deepEqual(input.context,[ownExchange]);
 assert(input.excerpts.every(source=>source.id.startsWith('production-rework')||source.id==='knowledge-rework'));
}),reserve,[ownExchange]);
assert.equal(eligibility.message,eligibilityProse);
const capturedEligibilityError='Yes, you can initiate Rework before the Job is complete, but only if the Job is already marked as complete. Rework can only be created for a completed, unarchived Job with no active Rework cycle.';
for(const prose of [capturedEligibilityError,'You can initiate Rework before the Job is complete.','Yes, but only if the Job is complete.']){
 await assert.rejects(answer({action:'ask',question:'Can I initiate Rework before completion?'},all,fixture({ids:['production-rework-create'],answer:prose}),reserve,[ownExchange]),/Rework eligibility wording/);
}
const eligibleYes=await answer({action:'ask',question:'Can I initiate Rework for a completed Job?'},all,fixture({ids:['production-rework-create'],answer:'Yes, if the Job is complete, unarchived, and has no active Rework cycle.'}),reserve);
assert.equal(eligibleYes.mode,'ai','A valid Yes for a completed Job must remain allowed');
const beforePlannedDate=await answer({action:'ask',question:'Can I do that before the planned finish date?'},all,fixture({ids:['production-rework-create'],answer:'Yes, if the Job is already complete, unarchived, and has no active Rework cycle. Rework preserves the original planned dates.'}),reserve,[ownExchange]);
assert.equal(beforePlannedDate.mode,'ai','A planned finish date is not the Job completion prerequisite');
const beforeDecision=await answer({action:'ask',question:eligibilityQuestion},all,noInference,reserve,[ownExchange]);
assert.equal(beforeDecision.mode,'verified');assert.match(beforeDecision.message,/^No\./);
assert.deepEqual(beforeDecision.sources.map(source=>source.id),['production-rework-create']);
assert.match(beforeDecision.message,/complete, unarchived, and have no active Rework/);
const deniedFollowup=await answer({action:'ask',question:eligibilityQuestion},readOnly,noInference,reserve,[ownExchange]);
assert.equal(deniedFollowup.resolution,'permission-denied');assert.deepEqual(deniedFollowup.sources,[]);
for(const [question,expected] of [
 ['Can I schedule a Job before it is complete?','production-schedule'],
 ['Can I create a group instead?','group'],
 ['How do I filter Manpower Reporting by Job?','manpower-job-filter'],
] as const){
 const resolved=resolveInput({action:'ask',question},[ownExchange]);
 assert.equal(resolved.directEntries[0]?.id,expected,question);
 assert(!resolved.entries.some(source=>source.modules.includes('rework')),question);
}
const switchedExchange='Conversation context:\nEmployee: How do I initiate Rework?\nTenBot: Open the completed Job and choose Create Rework.\nEmployee: How do I create a group conversation?\nTenBot: Choose New group and select a participant.';
assert(resolveInput({question:'Can I rename it?'},[switchedExchange]).entries.every(source=>source.modules.includes('messaging')),'Most recent topic outranks older Rework');
for(const question of ['Can I do that in Production before the Job is complete?','Can I do that in Rework before the Job is complete?']){
 const resolved=resolveInput({question},[ownExchange]);
 assert.equal(resolved.directEntries[0]?.id,'production-rework-create');
 assert(resolved.entries.every(source=>source.modules.includes('rework')),question);
}
const purchaseExchange='Conversation context:\nEmployee: How do I initiate Rework?\nTenBot: Open the completed Job and choose Create Rework.\nEmployee: How do I manage purchase orders?\nTenBot: Purchasing has draft and issued Purchase Orders.';
const purchaseFollowup=resolveInput({question:'Can I do that?'},[purchaseExchange]);
assert(purchaseFollowup.entries.length&&purchaseFollowup.entries.every(source=>source.modules.includes('purchasing')),'Generated-only current topic must supersede Rework');
const unknownExchange=purchaseExchange.replace('How do I manage purchase orders?','How do I tune the CNC machine?').replace('Purchasing has draft and issued Purchase Orders.','That workflow is not verified.');
assert.deepEqual(resolveInput({question:'Can I do that?'},[unknownExchange]).entries,[],'Unknown new topic must not resurrect Rework');
const dependentExchange=ownExchange+'\nEmployee: Can I do that with a planned Job?\nTenBot: Rework requires the Job to be complete.';
assert(resolveInput({question:'What about the dates?'},[dependentExchange]).entries.every(source=>source.modules.includes('rework')),'Dependent chain keeps its active topic');
const boundedFollowupOnly='Conversation context:\nEmployee: Can I do that before the Job is complete?\nTenBot: Rework can only be created for a completed, unarchived Job with no active Rework cycle.';
const boundedFollowupEntries=resolveInput({question:'What about the planned dates?'},[boundedFollowupOnly]).entries;
assert(boundedFollowupEntries.some(source=>source.id.startsWith('production-rework-'))&&boundedFollowupEntries.every(source=>source.modules.includes('rework')),'Retained own reply recovers the active topic when the initial question is outside bounded history');
const multilineExchange=ownExchange.replace('How do I initiate Rework for a Job?','How do I initiate Rework for a Job?\nI need the eligibility requirements.');
assert(resolveInput({question:'Can I do that before the Job is complete?'},[multilineExchange]).entries.some(source=>source.id==='production-rework-create'),'Multiline employee questions retain their active topic');
const clarification=await answer({action:'ask',question:groupQuestion},all,fixture({ids:[],answer:'Are you starting a new group or trying to add someone to an existing DM?'}),reserve);
assert.match(clarification.message,/\?$/);
await assert.rejects(answer({action:'ask',question:groupQuestion},all,fixture({ids:[],answer:'Choose Export payroll and download the invoices.'}),reserve),/verify|ungrounded|wording/i);

// A real Qwen answer inferred feature absence from unrelated Manpower
// sources. Missing precise coverage must stay unknown, including a bare No.
const payrollQuestion='Can TenOps automatically file payroll taxes from Manpower Reporting?';
assert.deepEqual(resolveInput({question:payrollQuestion}).directEntries,[]);
const payrollSourceIds=['knowledge-manpower','manpower-record-labor'];
const capturedPayrollError='TenOps does not automatically file payroll taxes from Manpower Reporting. Employees with business-write access can record labor in Manpower Reporting, but payroll tax filing is a separate process outside of this module. No automated tax filing functionality is described in the provided sources.';
for(const prose of [
 capturedPayrollError,
 'No, that is not supported.',
 'There is no automatic payroll tax filing in Manpower Reporting.',
 'Automatic payroll tax filing is unavailable in TenOps.',
 'TenOps cannot file payroll taxes.',
 'I cannot verify that workflow. However, TenOps does not support payroll tax filing.',
 'I cannot verify that workflow, so TenOps does not support payroll tax filing.',
 'I cannot confirm that workflow and there is no automatic payroll tax filing in TenOps.',
]){
 const reply=await answer({action:'ask',question:payrollQuestion},all,fixture({ids:payrollSourceIds,answer:prose}),reserve);
 assert.equal(reply.mode,'verified',prose);assert.equal(reply.resolution,'documentation-missing');
 assert.deepEqual(reply.sources,[]);assert.deepEqual(reply.notices,[]);assert.equal(reply.suggestionAllowed,false);
 assert.match(reply.message,/not have enough verified information/);
 assert.doesNotMatch(reply.message,/does not automatically file|not supported|outside of this module/);
}
const cautiousPayrollProse='I cannot verify automatic payroll tax filing from the supplied sources. Manpower Reporting supports recording labor by worker, task and work date. Please check with Product about payroll tax filing.';
const cautiousPayroll=await answer({action:'ask',question:payrollQuestion},all,fixture({ids:payrollSourceIds,answer:cautiousPayrollProse}),reserve);
assert.equal(cautiousPayroll.mode,'ai');assert.equal(cautiousPayroll.message,cautiousPayrollProse);
assert.equal(cautiousPayroll.resolution,'documentation-missing');assert.equal(cautiousPayroll.suggestionAllowed,false);
// Authoritative precise negative/partial flows retain their original result.
const documentedDmNo=await answer({action:'ask',question:'Can I add a third person to a personal DM?'},all,fixture({ids:['dm'],answer:'No, you cannot add a third person to a personal DM. Create a new group instead.'}),reserve);
assert.equal(documentedDmNo.mode,'ai');assert.equal(documentedDmNo.resolution,'partial');
const documentedLeadNo=await answer({action:'ask',question:'Can TenOps estimate material lead time?'},all,null,reserve);
assert.equal(documentedLeadNo.resolution,'partial');assert.equal(documentedLeadNo.sources[0]?.id,'material-lead');

// Unknown native Job sharing must stay unknown, including negative feature
// claims. TenBot's input restriction is not a ban on authorized Messaging.
const shareJobQuestion='Can I share a Job directly in Messaging?';
for(const prose of [
 'You can share a Job directly using a native Share Job control.',
 'You cannot share a job directly via a native Share Job control in Messaging.',
 'There is no native Share Job control in Messaging.',
 'Native Job sharing is not available in Messaging.',
 'TenOps does not support a native Share Job control.',
 'No native Share Job control exists.',
 'A native Share Job control is available in Messaging.',
 'TenOps supports native Job sharing.',
 'You cannot share a Job directly because that control is unverified.',
])await assert.rejects(answer({action:'ask',question:shareJobQuestion},all,fixture({ids:['share-job','knowledge-messaging'],answer:prose}),reserve),/Job sharing wording|verify/i,prose);
for(const prose of [
 'Keep private job records out of Messaging.',
 'Do not send private Job records in Messaging.',
 'Private Job records must not be shared in Messaging.',
 'Keep private Job records out of Messaging and TenBot.',
 'Keep private Job records out of normal Messaging.',
 'Keep private Job records out of ordinary employee conversations.',
])await assert.rejects(answer({action:'ask',question:shareJobQuestion},all,fixture({ids:['share-job','knowledge-messaging'],answer:prose}),reserve),/Messaging privacy wording|verify/i,prose);
for(const prose of [
 'I cannot verify a native Share Job control. You can type the Job reference as ordinary message text in an authorized conversation.',
 'Native Job sharing is not verified. Creating a group alone does not share a Job.',
 'I cannot confirm that you can share a Job directly with a native control.',
 'Keep private Job records out of TenBot. Ordinary authorized Messaging supports text and attachments.',
]){
 const reply=await answer({action:'ask',question:shareJobQuestion},all,fixture({ids:['share-job','knowledge-messaging'],answer:prose}),reserve);
 assert.equal(reply.mode,'ai');assert.equal(reply.message,prose);
}
const actualRejectedQwenShare="You cannot share a job directly via a native 'Share Job' control in Messaging. However, you can type the job reference as text in a message or attach a file you're authorized to share. Creating a group doesn't share a job. Keep private job records out of Messaging.";
await assert.rejects(answer({action:'ask',question:shareJobQuestion},all,fixture({ids:['share-job','knowledge-messaging'],answer:actualRejectedQwenShare}),reserve),/Job sharing wording|Messaging privacy wording|verify/i);

// Product permits explicitly submitted business/message text for this user's answer.
const privateQuestion='How do I create a group conversation?\nCustomer: Synthetic Acme\nInvoice: 8821';
const privateResult=await answer({action:'ask',question:privateQuestion},all,fixture({ids:['group'],answer:prose},input=>assert.equal(input.question,privateQuestion)),reserve);
assert.equal(privateResult.mode,'ai');
assert.deepEqual(retrieve('How do I edit my password in Contacts?',all),[]);
const beforeCredential=reserved;
const credentialResult=await answer({action:'ask',question:'How do I edit my password in Contacts?'},all,fixture({ids:[],answer:'I cannot verify that account workflow from the supplied sources.'}),reserve);
assert.equal(credentialResult.resolution,'documentation-missing');assert.deepEqual(credentialResult.sources,[]);
assert.match(credentialResult.message,/credentials|verif|confirm/i);assert.equal(reserved,beforeCredential+1);

// Output guards permit ordinary reasoning but reject bad source references,
// invented controls/links/metadata, privilege reversals and execution claims.
for(const output of [
 {ids:['private-secret'],answer:prose},
 {ids:['group','group'],answer:prose},
 {ids:['group','dm','notifications','customer-edit'],answer:prose},
 {ids:['group'],answer:'All participants can rename the group.'},
 {ids:['group'],answer:'Any member can add or remove group participants.'},
 {ids:['group'],answer:'Removed members can still read the full history.'},
 {ids:['group'],answer:'Not only creators, all participants can rename the group.'},
 {ids:['group'],answer:'Choose Export payroll to download every invoice.'},
 {ids:['group'],answer:'Click the "Admin Override" button.'},
 {ids:['group'],answer:'Open https://private.example/invented.'},
 {ids:['group'],answer:'Open /invented-route.'},
 {ids:['group'],answer:'Open (/invented-route).'},
 {ids:['group'],answer:'The UUID is 9b160e46-b65b-487e-912a-3794dd09a75c.'},
 {ids:['group'],answer:'The commit is bc628bd.'},
 {ids:['group'],answer:'I have created the group and granted you administrator access.'},
 {ids:['group'],answer:'I already sent the message to every employee.'},
 {ids:['group'],answer:'<script>alert(1)</script>'},
 {ids:['group'],answer:'x'.repeat(1401)},
 {ids:['group'],answer:null},
])await assert.rejects(answer({action:'ask',question:groupQuestion},all,fixture(output),reserve),/verify|ungrounded|wording/i);
assert.equal(groundedProse('Start with the group name, then choose the people you want to talk with. Once you are ready, choose Create group.',entry('group')).startsWith('Start'),true);
assert.equal(groundedProse(multiProse,[entry('production-rework-create'),entry('manpower-job-filter')]),multiProse);
const capturedSampleProse="To attach a sample to a bid, open the Intake module and select the bid. Then, go to Tools and choose 'Open related Samples'. From there, select 'Existing standalone Sample' and click 'Link Sample'. If you want to create a new sample, choose 'Create Sample' in the Bid's Tools, which will retain the bid, customer, and project context. You can also use the Sample editor to save a draft with bid context.";
assert.equal(groundedProse(capturedSampleProse,[entry('sample-bid'),generatedEntry('knowledge-sample-bid'),generatedEntry('knowledge-samples')]),capturedSampleProse);
const breadcrumbProse='Open the Job in Production, select Create Rework, enter the intake/return date, then select Create Rework. For labor, open Reporting > Manpower Reporting and choose the Job in Job labor review.';
assert.equal(groundedProse(breadcrumbProse,[entry('production-rework-create'),entry('manpower-job-filter')]),breadcrumbProse);
const incorrectDmProse='You can add someone to an existing personal DM by creating a new group and inviting the person.';
const accurateDmProse='You cannot add a person to a DM; create a new group instead. The old DM stays private.';
assert.throws(()=>groundedProse(incorrectDmProse,entry('dm')),/wording|verify/i);
assert.equal(groundedProse(accurateDmProse,entry('dm')),accurateDmProse);
await assert.rejects(answer({action:'ask',question:'Can I add someone to an existing personal DM?'},all,fixture({ids:['dm'],answer:incorrectDmProse}),reserve),/wording|verify/i);
const accurateDm=await answer({action:'ask',question:'Can I add someone to an existing personal DM?'},all,fixture({ids:['dm'],answer:accurateDmProse}),reserve);
assert.equal(accurateDm.message,accurateDmProse);assert.equal(accurateDm.resolution,'partial');
assert.throws(()=>groundedProse('Device registration guarantees notifications.',entry('notifications')),/wording|verify/i);
assert.throws(()=>groundedProse('Historical customer text establishes a Job link.',entry('customer-history')),/wording|verify/i);
await assert.rejects(answer({action:'ask',question:groupQuestion},all,{name:'failed',infer:async()=>{throw Error('synthetic private credential');}},reserve),/unavailable/);
await assert.rejects(answer({action:'ask',question:groupQuestion},all,fixture({ids:['group'],answer:prose}),async()=>{throw Error('budget exhausted');}),/budget/);
await assert.rejects(answer({action:'ask',question:'x'.repeat(1201)},all,null,reserve),/shorten/);

// Provider abstraction, feedback confirmation entry point and administrator
// aggregate usage remain intact. No fixture performs a real network call.
const fakeFetch=(async(_url,options)=>{const request=JSON.parse(String(options?.body));assert.equal(request.max_tokens,640);assert.equal(request.messages.length,2);assert(!String(options?.body).includes('service_role'));return Response.json({success:true,result:{response:JSON.stringify({ids:['group'],summary:''})}});}) as typeof fetch;
assert.deepEqual(await cloudflareProvider('fixture','not-a-secret',fakeFetch).infer({question:'group',context:[],excerpts:[],draft:false}),{ids:['group'],summary:''});
const draft=await answer({action:'draft',question:'group conversation'},all,fixture({ids:['group'],summary:'Create a clearer group entry point.'}),reserve);
assert.equal(draft.summary,'Create a clearer group entry point.');
await assert.rejects(handleTenbot({action:'list'},admin,async()=>({data:false,error:null}),async()=>({data:null,error:null}),null,0),/not authorized/);
const forbiddenCalls:string[]=[];
await assert.rejects(handleTenbot({action:'usage'},member,async(name,args)=>{forbiddenCalls.push(name);return {data:name==='has_app_capability'&&args?.p_capability==='readOperationalData',error:null};},async()=>({data:null,error:null}),null,.2),/not authorized/);
assert.deepEqual(forbiddenCalls,['has_app_capability','has_app_capability']);
const usage=await handleTenbot({action:'usage',budget:100},admin,async(name)=>({data:name==='has_app_capability'?true:{sharedDayUsed:4,sharedDayLimit:300},error:null}),async()=>({data:null,error:null}),null,.2);
assert.deepEqual(usage,{usage:{sharedDayUsed:4,sharedDayLimit:300}});
// Request-owned provider telemetry is authoritative; employee JSON cannot set
// reservation size, model, token counts or reconciliation amounts.
for(const outcome of ['completed','invalid-output','provider-failed'] as const){
 let actualInput:InferenceInput|null=null;
 const measurements=new WeakMap<InferenceInput,{model:typeof meteringModel;inputTokens:number;outputTokens:number;estimatedNeurons:number}>();
 const meteringModel='@cf/meta/llama-3.1-8b-instruct-fp8' as const;
 const calls:{name:string;args?:Record<string,unknown>}[]=[];
 const meteredProvider:InferenceProvider={name:'request-owned metering fixture',reserveEstimate:input=>{actualInput=input;return {model:meteringModel,neurons:250};},usage:input=>{assert.equal(input,actualInput);return measurements.get(input)||null;},infer:async input=>{
  assert.equal(input,actualInput);
  if(outcome==='provider-failed')throw Error('synthetic private failure');
  measurements.set(input,{model:meteringModel,inputTokens:1000,outputTokens:100,estimatedNeurons:16.391});
  return {ids:[outcome==='completed'?'group':'fabricated'],answer:prose};
 }};
 const caller=async()=>({data:true,error:null});
 const service=async(name:string,args?:Record<string,unknown>)=>{calls.push({name,args});return {data:name==='tenbot_reserve_usage'?'fixture-reservation':null,error:null};};
 const invocation=handleTenbot({action:'ask',question:groupQuestion,model:'paid-model',reservedNeurons:0,usage:{inputTokens:0}},admin,caller,service,meteredProvider,100);
 if(outcome==='completed')assert.equal((await invocation as Awaited<ReturnType<typeof answer>>).mode,'ai');else await assert.rejects(invocation);
 assert.deepEqual(calls[0],{name:'tenbot_reserve_usage',args:{p_user:admin,p_model:meteringModel,p_reserved_neurons:250}});
 assert.deepEqual(calls[1],{name:'tenbot_finish_usage',args:{p_id:'fixture-reservation',p_outcome:outcome==='completed'?'completed':'failed',p_model:meteringModel,p_input_tokens:outcome==='provider-failed'?null:1000,p_output_tokens:outcome==='provider-failed'?null:100,p_estimated_neurons:outcome==='provider-failed'?null:16.391}});
}
console.log(`${knowledgeEntries.length} generated module knowledge chunks passed release/provenance/privacy/permission checks and natural-question AI-vs-fallback cases.`);
console.log(`${corpusCases} maintained workflow examples passed primary retrieval, direct-search fallback and released source-file provenance checks.`);
console.log('Exact Rework, Manpower and Contacts regressions, unknown/permission/unavailable distinctions, Proposal RPC isolation, actual filtered conversational input, multiple sources, own-dialogue follow-up, clarification and bounded output/failure guards passed. No real inference or hosted verification claimed.');
if(process.argv.includes('--core-only'))process.exit(0);
const meteredModel='@cf/meta/llama-3.1-8b-instruct-fp8';
const reserveSql=(user:string,neurons=200)=>`select tenbot_reserve_usage(${literal(user)},${literal(meteredModel)},${neurons})`;
if(process.argv.includes('--pilot-local-only')){
 // Existing task-owned local fixture only. Every seeded cap row is rolled
 // back or removed by exact generated IDs. Historical reservations stay intact.
 const local='tenops-tenbot-review',before=sql(local,'select count(*) from tenbot_usage');
 const policy=JSON.parse(sql(local,asUser('select tenbot_usage_summary()',admin)));
 assert.equal(policy.sharedDayLimit,300);assert.equal(policy.sharedMonthLimit,6000);assert.equal(policy.dayNeuronLimit,8000);assert.equal(policy.monthNeuronLimit,240000);
 for(const user of [admin,member]){
  assert.throws(()=>sql(local,`begin;delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,reserved_neurons,created_at) select ${literal(user)}::uuid,0,1,now()-interval '2 minutes' from generate_series(1,${policy.sharedDayLimit});${asUser(reserveSql(user),admin,'service_role')};rollback;`),/shared daily pool/);
  assert.equal(sql(local,'select count(*) from tenbot_usage'),before);
 }
 const shared=sql(local,`begin;delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,reserved_neurons,created_at) select ${literal(member)}::uuid,0,1,now()-interval '2 minutes' from generate_series(1,13);${asUser(reserveSql(member),admin,'service_role')};reset role;select count(*) from tenbot_usage;rollback;`);
 assert.equal(shared.trim().split('\n').at(-1),'14');assert.equal(sql(local,'select count(*) from tenbot_usage'),before);
 assert.throws(()=>sql(local,`begin;delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,reserved_neurons,created_at) values(${literal(member)},0,7990,now()-interval '2 minutes');${asUser(reserveSql(admin,20),admin,'service_role')};rollback;`),/daily inference budget/);
 assert.equal(sql(local,'select count(*) from tenbot_usage'),before);
 const ids=Array.from({length:policy.sharedDayLimit},()=>randomUUID());
 const lines=()=>{try{return readFileSync(pilotDirectory+'/usage.jsonl','utf8').trim().split('\n').length;}catch{return 0;}};
 const calls=lines(),token='local.'+Buffer.from(JSON.stringify({sub:admin})).toString('base64url')+'.local';
 const invoke=async(auth=token,origin='http://localhost:3000')=>fetch('http://localhost:55593/',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({action:'ask',question:'How do I create a group conversation?'})});
 try{
  sql(local,`insert into tenbot_usage(id,user_id,reserved_usd,reserved_neurons,created_at) values ${ids.map(id=>`(${literal(id)},${literal(admin)},0,1,now()-interval '2 minutes')`).join(',')}`);
  const response=await invoke();assert.equal(response.status,200);const result=await response.json();assert.equal(result.mode,'guide');assert.equal(result.fallback,true);assert.equal(result.sources[0].id,'group');
  assert.equal(lines(),calls,'A capped request must not invoke remote inference');
  assert.equal((await invoke('invalid')).status,401);assert.equal((await invoke(token,'http://untrusted.local')).status,403);
 }finally{sql(local,`delete from tenbot_usage where id in (${ids.map(literal).join(',')})`);}
 assert.equal(sql(local,'select count(*) from tenbot_usage'),before);
 console.log('Persistent300/day6000/month sharedpool,8000/240000 Neuronbudget, no per-account dailyallocation, rollback, direct fallback without inference, auth/origin isolation and historical-ledger preservation passed.');
 process.exit(0);
}
const name='tenops-tenbot-verify-'+process.pid;
try{startIntakeDatabase(name);sql(name,readFileSync('supabase/migrations/20261027120000_tenbot_feedback_usage.sql','utf8'));sql(name,readFileSync('supabase/migrations/20261027130000_tenbot_shared_usage_pool.sql','utf8'));
 // Applied predecessor entries survive unchanged, retaining conservative unknown
 // usage; changing policy is not a refund, reset or rewriting historical spend.
 sql(name,`insert into tenbot_usage(user_id,reserved_usd,created_at) select ${literal(member)}::uuid,0.01,now()-interval '2 minutes' from generate_series(1,20)`);
 const legacy=sql(name,"select jsonb_agg(to_jsonb(t) order by id) from (select id,user_id,created_at,reserved_usd,outcome from tenbot_usage) t");
 sql(name,readFileSync('supabase/migrations/20261027140000_tenbot_measured_free_pool.sql','utf8'));
 assert.equal(sql(name,"select jsonb_agg(to_jsonb(t) order by id) from (select id,user_id,created_at,reserved_usd,outcome from tenbot_usage) t"),legacy);
 const run=(statement:string,id=admin,role='authenticated')=>sql(name,asUser(statement,id,role));
 let state=JSON.parse(run('select tenbot_usage_summary()'));assert.equal(state.sharedDayUsed,20);assert.equal(state.dayAccountedNeurons,4000);assert.equal(state.dayUnmeasuredAttempts,20);
 run(reserveSql(admin),admin,'service_role');assert.equal(JSON.parse(run('select tenbot_usage_summary()')).sharedDayUsed,21);
 assert.throws(()=>run(`select tenbot_reserve_usage(${literal(admin)},1)`,admin,'service_role'),/permission denied/);
 assert.throws(()=>run(`select tenbot_finish_usage(gen_random_uuid(),'failed')`,admin,'service_role'),/permission denied/);
 sql(name,'delete from tenbot_usage');
 const draft={capability:'Recurring task',problem:'Repeat manual entry',desired:'Weekly schedule',module:'My Work',original:'can I repeat a task?',summary:'Weekly tasks',summaryKind:'Employee-written',context:''};
 assert.throws(()=>run(`select tenbot_submit_feedback(${json(draft)},false)`),/Confirmed/);
 assert.throws(()=>run(`select tenbot_submit_feedback(${json({...draft,submitter_id:admin})},true)`),/Unknown/);
 assert.throws(()=>run(`select tenbot_submit_feedback(${json({...draft,summary:{unexpected:'object'}})},true)`),/must be text/);
 const id=run(`select tenbot_submit_feedback(${json(draft)},true)`,member);
 assert.equal(run(`select to_jsonb(submitter_id) from tenbot_feedback where id=${literal(id)}`,admin,'postgres').trim(),JSON.stringify(member));
 assert.throws(()=>run(`select tenbot_list_feedback('','')`,member),/Not authorized/);
 assert.throws(()=>run(`select tenbot_review_feedback(${literal(id)},'Shipped','')`,member),/Not authorized/);
 for(const table of ['tenbot_feedback','tenbot_feedback_history','tenbot_usage'])assert.throws(()=>run(`select * from ${table}`,member),/permission denied/);
 assert.throws(()=>run(reserveSql(member),member),/permission denied/);
 assert.throws(()=>run(`select tenbot_usage_policy()`,admin,'service_role'),/permission denied/);
 assert.throws(()=>run(`select tenbot_list_feedback('','')`,admin,'anon'),/permission denied/);
 run(`select tenbot_review_feedback(${literal(id)},'Under Consideration','Needs Product review')`);
 const listed=JSON.parse(run(`select tenbot_list_feedback('Under Consideration','My Work')`));assert.equal(listed.length,1);assert.equal(listed[0].history.length,2);assert.equal(listed[0].draft.original,draft.original);
 assert.throws(()=>run(`select tenbot_review_feedback(${literal(id)},'Approved','')`),/Invalid/);
 const reservation=run(reserveSql(member),admin,'service_role');
 assert.throws(()=>run(`select tenbot_finish_usage(${literal(reservation)},'completed',${literal(meteredModel)},1000,null,16.391)`,admin,'service_role'),/Incomplete/);
 assert.throws(()=>run(`select tenbot_finish_usage(${literal(reservation)},'completed',${literal(meteredModel)},-1,100,16.391)`,admin,'service_role'),/Invalid/);
 assert.throws(()=>run(`select tenbot_finish_usage(${literal(reservation)},'completed','other-model',1000,100,16.391)`,admin,'service_role'),/Invalid|unavailable/);
 assert.throws(()=>run(`select tenbot_finish_usage(${literal(reservation)},'completed',${literal(meteredModel)},1000,100,0)`,admin,'service_role'),/Invalid/);
 run(`select tenbot_finish_usage(${literal(reservation)},'completed',${literal(meteredModel)},1000,100,16.391)`,admin,'service_role');
 assert.throws(()=>run(`select tenbot_finish_usage(${literal(reservation)},'completed',${literal(meteredModel)},1000,100,16.391)`,admin,'service_role'),/unavailable/);
 for(let i=0;i<5;i++)run(reserveSql(member),admin,'service_role');
 assert.throws(()=>run(reserveSql(member),admin,'service_role'),/rate limit/);
 run(reserveSql(admin),admin,'service_role');
 assert.throws(()=>run('select tenbot_usage_summary()',member),/Not authorized/);
 for(const role of ['anon','service_role'])assert.throws(()=>run('select tenbot_usage_summary()',admin,role),/permission denied/);
 state=JSON.parse(run('select tenbot_usage_summary()'));
 assert.equal(state.sharedDayUsed,7);assert.equal(state.sharedDayRemaining,293);assert.equal(state.dayAccountedNeurons,1216.391);assert.equal(state.dayMeasuredInputTokens,1000);assert.equal(state.dayMeasuredOutputTokens,100);assert.equal(state.dayUnmeasuredAttempts,6);
 assert.equal(/user_id|submitter|draft|00000000/.test(JSON.stringify(state)),false);
 // Both accounts draw from the same final slots; no individual daily quota.
 sql(name,`delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,reserved_neurons,created_at) select case when n<=150 then ${literal(member)}::uuid else ${literal(admin)}::uuid end,0,1,now()-interval '2 minutes' from generate_series(1,298)n`);
 run(reserveSql(member),admin,'service_role');run(reserveSql(admin),admin,'service_role');
 for(const user of [admin,member])assert.throws(()=>run(reserveSql(user),admin,'service_role'),/shared daily pool/);
 state=JSON.parse(run('select tenbot_usage_summary()'));assert.equal(state.sharedDayUsed,300);assert.equal(state.sharedDayRemaining,0);assert.equal(state.dayAccountedNeurons,698);
 sql(name,"delete from tenbot_usage where id=(select id from tenbot_usage order by created_at limit 1)");
 const compete=await Promise.allSettled([admin,member].map(user=>promisify(execFile)('docker',['exec',name,'psql','-qAt','-U','postgres','-v','ON_ERROR_STOP=1','-c',asUser(reserveSql(user),admin,'service_role')])));
 assert.equal(compete.filter(result=>result.status==='fulfilled').length,1);
 assert.match((compete.find(result=>result.status==='rejected') as PromiseRejectedResult).reason.stderr,/shared daily pool/);
 assert.equal(JSON.parse(run('select tenbot_usage_summary()')).sharedDayUsed,300);
 // A few large or unmeasured requests can exhaust the firm global budget
 // before request counts; failed/unknown calls never receive a guessed refund.
 sql(name,`delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,reserved_neurons,created_at,outcome) values(${literal(member)},0,7999,now()-interval '2 minutes','failed')`);
 assert.throws(()=>run(reserveSql(admin,2),admin,'service_role'),/daily inference budget/);
 run(reserveSql(admin,1),admin,'service_role');
 assert.equal(JSON.parse(run('select tenbot_usage_summary()')).dayAccountedNeurons,8000);
 if(new Date().getUTCDate()>1){
  sql(name,"update tenbot_usage set created_at=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-interval '1 second'");
  run(reserveSql(member),admin,'service_role');assert.equal(JSON.parse(run('select tenbot_usage_summary()')).sharedDayUsed,1);
  sql(name,`delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,reserved_neurons,created_at) select ${literal(member)}::uuid,0,.01,date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' from generate_series(1,6000)`);
  assert.throws(()=>run(reserveSql(admin),admin,'service_role'),/shared monthly pool/);
  sql(name,`delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,reserved_neurons,created_at) values(${literal(member)},0,239999,date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')`);
  assert.throws(()=>run(reserveSql(admin,2),admin,'service_role'),/monthly inference budget/);
  run(reserveSql(admin,1),admin,'service_role');assert.equal(JSON.parse(run('select tenbot_usage_summary()')).monthAccountedNeurons,240000);
 }
 sql(name,`update app_users set is_active=false where user_id=${literal(member)}`);
 assert.throws(()=>run(`select tenbot_submit_feedback(${json(draft)},true)`,member),/Not authorized/);
 assert.throws(()=>run(reserveSql(member),admin,'service_role'),/Not authorized/);
 console.log('PostgreSQL forward-policy/data-preservation, legacy-RPC revocation, existing feedback/privacy, token/Neuron reconciliation, conservative unknown failures,300/day6000/month shared pool,8000/day240000/month atomic budgets, concurrency,6/account/min, UTC reset and administrator-only aggregates passed.');
}finally{docker(['stop',name]);}
