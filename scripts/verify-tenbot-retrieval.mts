/** Focused offline retrieval regressions. No provider, database, browser or network. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {agentKnowledgeEntries} from '../supabase/functions/_shared/tenbot-agent-knowledge';
import {createTenbotAgentKnowledgeTools,searchPublishedKnowledge} from '../supabase/functions/_shared/tenbot-agent-operations';
import {hasGuidePermission,knowledgeProofValue,publishedKnowledgeSource,type CapabilityEntry} from '../supabase/functions/_shared/tenbot-knowledge';

const entries=agentKnowledgeEntries(),byId=new Map(entries.map(entry=>[entry.id,entry]));
const grants=new Set(entries.flatMap(entry=>[entry.permission,...entry.additionalPermissions??[]]));
type Result=Awaited<ReturnType<typeof searchPublishedKnowledge>>;
type FixtureEntry=CapabilityEntry&{provenance?:unknown;dependencyBindings?:unknown};
const checks:string[]=[];
const check=async(name:string,run:()=>void|Promise<void>)=>{await run();checks.push(name);};
const context={callerId:'offline-synthetic-owner',signal:new AbortController().signal};
const tool=createTenbotAgentKnowledgeTools(async capability=>grants.has(capability),()=>[{name:'get_job_summary',kind:'read'}])[0];
const search=async(query:string)=>(await tool.execute({query},context)).data as unknown as Result;
const fixture=(id:string,changes:Partial<FixtureEntry>={}):FixtureEntry=>({
 id,title:'Synthetic equivalence',terms:'synthetic equivalence',modules:['synthetic'],requiredTerms:[],
 status:'deployed',permission:'read',additionalPermissions:['write'],route:'/synthetic',path:'Synthetic workflow',
 guidance:'Shared reviewed guidance.',source:'Same reviewed source',evidence:'same-evidence',sourceFiles:['docs/workflows/SYNTHETIC.md'],examples:[],
 architecture:{entities:['Work record'],relationships:[],facts:[],preconditions:[],effects:['A reviewed effect.'],approvalRequirements:[],limitations:[]},
 relatedRecordIds:[],toolNames:[],recordDigest:createHash('sha256').update(id).digest('hex'),
 releaseBoundary:{id:'same-release',revision:'a'.repeat(40),verifiedAt:'2026-10-29',receipt:'docs/review.md',receiptKind:'released'},
 provenance:[{path:'docs/workflows/SYNTHETIC.md',revision:'a'.repeat(40),blob:'b'.repeat(40)}],
 dependencyBindings:[{path:'docs/workflows/SYNTHETIC.md',kind:'semantic',blob:'b'.repeat(40)}],
 ...changes,
});

await check('exact Material Usage cross-module query preserves the no-consumption rule',async()=>{
 const result=await search('Material Usage consumes Inventory reservation');
 const source=result.sources.find(source=>source.id==='workflow-material-usage');assert(source);
 assert.match(JSON.stringify(source),/does not automatically decrement Inventory or consume a reservation/);
 assert.match(JSON.stringify(source),/Inventory outtake is a separate existing operation/);
 assert.equal(source.path,'Reporting → Material Usage → New → Save Report; history sidebar');
});
await check('PO split paraphrase returns allocation controls, units and the header distinction',async()=>{
 const result=await search('purchasing bags one project and stock split');
 const source=result.sources.find(source=>source.id==='workflow-po-allocations');assert(source);
 assert.match(source.guidance,/choose Allocate, then Add Job allocation/);
 assert.match(source.guidance,/PO order unit/);
 assert.match(source.guidance,/remainder stays general stock/);
 assert.match(source.guidance,/document-level Job context alone does not allocate material/);
 assert.match(JSON.stringify(source),/only when actually received/);
});
await check('same-authority aliases do not consume the four direct-result slots',async()=>{
 const aliases=Array.from({length:4},(_,index)=>fixture('a-alias-'+index,{title:'Synthetic equivalence alias '+index}));
 const independent=Array.from({length:3},(_,index)=>fixture('z-evidence-'+index,{guidance:'Independent reviewed guidance '+index+'.'}));
 const result=await searchPublishedKnowledge('synthetic equivalence',[...aliases,...independent],async()=>true);
 assert.equal(result.sources.length,4);
 assert.equal(result.sources.filter(source=>source.id.startsWith('a-alias-')).length,1);
 for(const entry of independent)assert(result.sources.some(source=>source.id===entry.id));
 const chosen=result.sources.find(source=>source.id.startsWith('a-alias-'))!;
 const representative=aliases.find(entry=>entry.id===chosen.id)!;
 assert.deepEqual(chosen,publishedKnowledgeSource(representative),'Publish an existing exact source, never a merged alias');
 assert.equal(knowledgeProofValue(representative,chosen).authority.recordDigest,representative.recordDigest);
 assert.notDeepEqual(knowledgeProofValue(aliases[0]),knowledgeProofValue(aliases[1]),'Actual per-record proof identity remains distinct');
 assert.doesNotMatch(JSON.stringify(result),/recordDigest|provenance|dependencyBindings|sourceFiles|same-evidence/);
});
await check('equivalence is applied before the two-seed cap and again to related results',async()=>{
 const aliases=Array.from({length:4},(_,index)=>fixture('a-seed-'+index,{relatedRecordIds:['dependent-a','dependent-a-alias']}));
 const second=fixture('b-seed',{guidance:'Second independent seed.',relatedRecordIds:['dependent-b']});
 const dependentA=fixture('dependent-a',{title:'Unrelated',terms:'unrelated',modules:[],guidance:'First related evidence.'});
 const dependentAlias={...dependentA,id:'dependent-a-alias',recordDigest:'c'.repeat(64)};
 const dependentB=fixture('dependent-b',{title:'Unrelated',terms:'unrelated',modules:[],guidance:'Second related evidence.'});
 const result=await searchPublishedKnowledge('synthetic equivalence',[...aliases,second,dependentA,dependentAlias,dependentB],async()=>true);
 assert.deepEqual(result.sources.map(source=>source.id),['a-seed-0','b-seed','dependent-a','dependent-b']);
});
await check('each alias is authorized before equivalence, including denied and failed grants',async()=>{
 const denied=fixture('a-denied',{title:'Synthetic equivalence denied alias'}),permitted=fixture('b-permitted');
 const seen:string[]=[];
 const result=await searchPublishedKnowledge('synthetic equivalence',[denied,permitted],async entry=>{seen.push(entry.id);return entry.id!==denied.id;});
 assert.deepEqual(seen,[denied.id,permitted.id]);assert.equal(result.access_limited,true);
 assert.deepEqual(result.sources,[publishedKnowledgeSource(permitted)]);
 assert.doesNotMatch(JSON.stringify(result),/Synthetic equivalence denied alias|a-denied/);
 const restricted=fixture('restricted',{additionalPermissions:['write','restricted']});
 const current=new Set(['read','write']);
 const held=await searchPublishedKnowledge('synthetic equivalence',[restricted,permitted],async entry=>hasGuidePermission(entry,current));
 assert(held.access_limited);assert.deepEqual(held.sources,[publishedKnowledgeSource(permitted)]);
 await assert.rejects(searchPublishedKnowledge('synthetic equivalence',[denied,permitted],async()=>{throw Error('Grant check unavailable');}));
});
await check('distinct facts, grants, routes, tools, relationships and source authority remain independent',async()=>{
 const base=fixture('a-base');
 const variants:Partial<FixtureEntry>[]=[
  {architecture:{...base.architecture!,facts:[{text:'Another reviewed fact.',classification:'operational-rule',verification:'repository-contract'}]}},
  {architecture:{...base.architecture!,effects:['A different reviewed effect.']}},
  {architecture:{...base.architecture!,limitations:['An independent constraint.']}},
  {route:'/different-route'},{path:'Different workflow'},
  {permission:'another-read'},{additionalPermissions:['another-write']},
  {toolNames:['get_job_summary']},{relatedRecordIds:['independent-dependency']},
  {releaseBoundary:{...base.releaseBoundary!,revision:'d'.repeat(40)}},
  {provenance:[{path:'docs/workflows/OTHER.md',revision:'a'.repeat(40),blob:'b'.repeat(40)}]},
  {dependencyBindings:[{path:'docs/workflows/OTHER.md',kind:'semantic',blob:'b'.repeat(40)}]},
  {sourceFiles:['docs/workflows/OTHER.md']},{source:'Independent source authority'},{evidence:'independent-evidence'},
  {capabilityAvailability:{application:'partial',assistant:'guidance-only'}},
 ];
 for(const changes of variants){
  const other=fixture('b-independent',changes);
  const result=await searchPublishedKnowledge('synthetic equivalence',[base,other],async()=>true);
  assert.equal(result.sources.length,2,JSON.stringify(changes));
  for(const entry of [base,other])assert.deepEqual(result.sources.find(source=>source.id===entry.id),publishedKnowledgeSource(entry));
 }
 const spaced=fixture('b-whitespace',{guidance:'Shared   reviewed\n guidance.'});
 const collapsed=await searchPublishedKnowledge('synthetic equivalence',[base,spaced],async()=>true);
 assert.deepEqual(collapsed.sources,[publishedKnowledgeSource(base)],'Whitespace normalization changes selection only, never the published representative');
});
await check('current Bid and Manpower prose repeats retain their independent structured authority',async()=>{
 for(const ids of [['knowledge-intake','sample-bid','knowledge-sample-bid'],['knowledge-manpower','workflow-manpower-history']]){
  const records=ids.map(id=>byId.get(id)!);assert(records.every(Boolean));
  assert.equal(new Set(records.map(entry=>entry.guidance.replace(/\s+/g,' ').trim())).size,1);
  const result=await searchPublishedKnowledge(ids[0]==='knowledge-intake'?'Bid preparation':'Manpower reporting',records,async()=>true);
  assert.equal(result.sources.length,records.length);
  for(const entry of records)assert.deepEqual(result.sources.find(source=>source.id===entry.id),publishedKnowledgeSource(entry));
 }
});
await check('grant revocation, actual registered links and unrelated Messaging guidance remain intact',async()=>{
 const result=await search('How do I create a group conversation?');
 const group=result.sources.find(source=>source.id==='group');assert(group);
 assert.match(group.guidance,/New group.*group name.*at least one other participant.*Create group/);
 const again=await search('Material Usage consumes Inventory reservation');
 assert(again.sources.some(source=>source.id==='workflow-material-usage'));
 grants.delete('writeBusinessData');
 try{
  const revoked=await search('Material Usage consumes Inventory reservation');
  assert(revoked.access_limited);assert(!revoked.sources.some(source=>source.id==='workflow-material-usage'));
  for(const source of revoked.sources)assert(hasGuidePermission(byId.get(source.id)!,grants));
 }finally{grants.add('writeBusinessData');}
 const linked=fixture('tool-source',{toolNames:['get_job_summary','execute_sql']});
 const links=await searchPublishedKnowledge('synthetic equivalence',[linked],async()=>true,[{name:'get_job_summary',kind:'read'}]);
 assert.deepEqual(links.capability_links,[{source_id:linked.id,tools:[{name:'get_job_summary',kind:'read'}],execution:false}]);
 assert.doesNotMatch(JSON.stringify(links),/execute_sql/);
});
await check('candidate count, byte and one-hop bounds are unchanged',async()=>{
 const sources=Array.from({length:20},(_,index)=>fixture('bounded-'+index,{guidance:'界'.repeat(1800)+index,relatedRecordIds:['bounded-'+((index+1)%20)]}));
 const result=await searchPublishedKnowledge('synthetic equivalence',sources,async()=>true);
 assert(result.sources.length<=4);assert(result.context_limited);assert.equal(result.complete,false);
 assert(new TextEncoder().encode(JSON.stringify(result.sources)).byteLength<=16000);
 const root=fixture('root',{relatedRecordIds:['child']}),child=fixture('child',{title:'Unrelated',terms:'unrelated',modules:[],guidance:'One hop.',relatedRecordIds:['grandchild']}),grandchild=fixture('grandchild',{title:'Unrelated',terms:'unrelated',modules:[],guidance:'Second hop.'});
 const bounded=await searchPublishedKnowledge('synthetic equivalence',[root,child,grandchild],async()=>true);
 assert.deepEqual(bounded.sources.map(source=>source.id),['root','child']);
 const aliases=Array.from({length:30},(_,index)=>fixture('a-'+String(index).padStart(2,'0')));
 const outside=fixture('z-outside',{guidance:'Outside bounded candidate window evidence.'}),authorized:string[]=[];
 const window=await searchPublishedKnowledge('synthetic equivalence',[...aliases,outside],async entry=>{authorized.push(entry.id);return true;});
 assert.deepEqual(authorized,aliases.slice(0,24).map(entry=>entry.id),'Filling deduplicated slots must not enlarge the 24-candidate permission window');
 assert.deepEqual(window.sources,[publishedKnowledgeSource(aliases[0])]);
 assert.doesNotMatch(JSON.stringify(window),/z-outside|Outside bounded candidate window evidence/);
});
console.log(JSON.stringify({passed:true,groups:checks.length,checks,mode:'Focused offline actual retrieval with synthetic grants and evidence fixtures; no model, database or browser',inferenceCalls:0,databaseRequests:0}));
