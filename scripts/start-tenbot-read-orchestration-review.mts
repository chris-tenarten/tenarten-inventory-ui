/** Product review transport only: synthetic Auth/records and explicitly scripted
 * planning through the actual hosted read-only handler. No live AI or database.
 * Importing this file creates no server; root owns replacing the old review API.
 */
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
import {reviewSession,REVIEW_EMAIL} from './support/messaging-groups-review-fixture.mjs';
import {wave2Response} from './support/wave2-fixture.mjs';
import {createHostedTenbot} from '../supabase/functions/_shared/tenbot-hosted';
import type {InferenceInput,InferenceProvider} from '../supabase/functions/_shared/tenbot-core';
import {defaultModel,measuredUsage} from '../supabase/functions/_shared/tenbot-models';
import type {AgentFinal,JsonValue} from '../supabase/functions/_shared/tenbot-agent';

const port=55597,origin='http://localhost:3000';
export const REVIEW_NOTICE='Synthetic records and simulated tool planning; no live inference';
const directory='/private/tmp/tenbot-read-orchestration-20261101';
type Row=Record<string,unknown>;
type Call={id:string;name:string;arguments:Record<string,JsonValue>};
type Output={calls:Call[];final:AgentFinal|null};
type Evidence={evidence_id:string;tool:string;data:Row};
const object=(value:unknown):value is Row=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown)=>typeof value==='string'?value:'';
const records=(value:unknown):Row[]=>Array.isArray(value)?value.filter(object):[];
const examples=[
 'Give me a quick handoff for Job "chris-dev-test": saved dates, labor hours, and unresolved follow-ups.',
 'Show labor for Job "chris-dev-test" from 2026-10-26 through 2026-11-01, including the days reported.',
 'Was any of that rework, or all the original run?',
 'For Job "chris-dev-test", is the planned finish before its requested delivery?',
 'What about the other one?',
];

/** These finite review cases are transport doubles, not model quality evidence
 * or production intent handling. Unknown questions receive a labeled prompt.
 */
export function createTenbotReadOrchestrationReview(){
 const f=createContextFixture(reviewSession.user.id),target=f.tables.jobs[0],other=f.tables.jobs[1];
 f.tables.jobs=[target,other];
 Object.assign(target,{name:'chris-dev-test',job_number:'DEV-20260803',material_status:'ordered',requested_delivery_date:'2026-11-20',planned_start:'2026-10-01',planned_end:'2026-11-15'});
 Object.assign(other,{name:'Synthetic Other Job',job_number:'QA-7102',material_status:'unknown',requested_delivery_date:null,planned_start:null,planned_end:null});
 const cycleId='11902026-0000-4000-8000-000000000301';
 f.tables.production_rework_cycles=[{id:cycleId,job_id:target.id,sequence_number:1,production_status:'complete',planned_start:'2026-10-30',planned_end:'2026-10-31',updated_at:'2026-11-01T12:00:00Z'}];
 f.tables.manpower_entries=[
  {id:'11902026-0000-4000-8000-000000000401',job_id:target.id,rework_cycle_id:null,work_date:'2026-10-30',am_hours:3,pm_hours:2,updated_at:'2026-11-01T12:00:00Z'},
  {id:'11902026-0000-4000-8000-000000000402',job_id:target.id,rework_cycle_id:cycleId,work_date:'2026-10-31',am_hours:2,pm_hours:0,updated_at:'2026-11-01T12:00:00Z'},
 ];
 Object.assign(f.tables,{job_updates:[{id:'11902026-0000-4000-8000-000000000501',job_id:target.id,requires_follow_up:true,resolved_at:null,updated_at:'2026-11-01T12:00:00Z'}]});
 const trace:{sequence:number;kind:string;name?:string;args?:unknown;status?:string;calls?:Call[];outcome?:string}[]=[],measurements=new WeakMap<InferenceInput,NonNullable<ReturnType<typeof measuredUsage>>>();
 let sequence=0,scriptedSteps=0;
 const record=(entry:Omit<(typeof trace)[number],'sequence'>)=>{trace.push({sequence:++sequence,...entry});if(trace.length>500)trace.shift();};
 const base=f.state.jobTools!;
 const jobTools={authorizeHistory:base.authorizeHistory,async execute(name:Parameters<typeof base.execute>[0],args:Record<string,unknown>){
  const result=await base.execute(name,args);record({kind:'authorized-synthetic-read',name,args:structuredClone(args),status:result.status});return result;
 }};
 const qwen:InferenceProvider={
  name:'OFFLINE scripted planning transport — no model inference',
  reserveEstimate:()=>({model:defaultModel,neurons:1}),
  usage:input=>measurements.get(input)??null,
  async infer(input,signal){
   if(signal?.aborted)throw Error('Scripted review cancelled');
   if(!input.agent)throw Error('This review only supports the scripted agent transport');
   scriptedSteps++;
   // Zero-token telemetry exists solely to exercise the adapter's metering
   // contract against synthetic RPCs. It is not a measured provider response.
   measurements.set(input,measuredUsage(defaultModel,{prompt_tokens:0,completion_tokens:0})!);
   const history=input.agent.history,submitted=history.find(item=>item.kind==='user');
   const request=submitted?.kind==='user'?JSON.parse(submitted.content) as Row:{};
   const question=text(request.question),q=question.toLowerCase(),contexts=records(request.server_context);
   const prior=contexts.find(item=>item.question==='Current conversation subject');
   let selectors:Row={};
   if(typeof prior?.answer==='string'){
    const start=prior.answer.indexOf('{'),end=prior.answer.indexOf('}. Requery');
    if(start>=0&&end>start)try{selectors=JSON.parse(prior.answer.slice(start,end+1));}catch{/* Unrecognized fixture context cannot select a record. */}
   }
   const selection=object(selectors.selection)?selectors.selection:{};
   const evidence:Evidence[]=history.flatMap(item=>{
    if(item.kind!=='tool_result')return [];
    try{const value:unknown=JSON.parse(item.output);return object(value)&&typeof value.evidence_id==='string'&&object(value.data)?[{evidence_id:value.evidence_id,tool:item.name,data:value.data}]:[];}catch{return [];}
   });
   const last=(name:string)=>evidence.findLast(item=>item.tool===name);
   const calls=(items:{name:string;args:Record<string,JsonValue>}[]):Output=>({calls:items.map((item,index)=>({id:'scripted_'+scriptedSteps+'_'+index,name:item.name,arguments:item.args})),final:null});
   const finish=(observations:AgentFinal['observations']=[],questions:string[]=[]):Output=>({calls:[],final:{answer:observations.map(item=>item.text).join(' ')||questions.join(' '),observations,inferences:[],recommendations:[],questions,completed_actions:[]}});
   let output:Output;
   const isOther=/\bother\s+one\b/.test(q),compound=/\bsaved dates\b/.test(q)&&/\blabor hours\b/.test(q)&&/\bfollow-ups\b/.test(q);
   const selectionOnly=/^(?:DEV-20260803|QA-7102)(?:\s|[.!—-]|$)/i.test(question.trim());
   const labor=compound||/\blabor\b|\brework\b.*\boriginal run\b/.test(q)||selectionOnly&&selectors.operation==='get_job_labor_summary';
   const planning=!labor&&(/\bplanned (?:finish|dates)\b|\bsaved schedule\b|\bfinish then\b/.test(q)||selectionOnly&&selectors.operation==='get_job_planning');
   const supported=compound||labor||planning;
   const names=supported&&!isOther?['find_jobs',...(compound?['get_job_summary','get_job_labor_summary']:labor?['get_job_labor_summary']:['get_job_planning'])]:[];
   if(!supported||isOther)output=finish([],['Which exact Job number or full project name should this scripted review use?']);
   else if(!history.some(item=>item.kind==='tool_result'&&item.name==='discover_capabilities'))output=calls([{name:'discover_capabilities',args:{names}}]);
   else{
    const explicit=question.match(/["“]([^"”\n]+)["”]/)?.[1]??question.match(/\b(?:Job\s+)?(DEV-20260803|QA-7102)\b/i)?.[1];
    const found=last('find_jobs'),payload=found&&object(found.data.data)?found.data.data:{};
    const jobs=records(payload.jobs),canonical=Array.isArray(selectors.references)?selectors.references.filter((id):id is string=>typeof id==='string'):[];
    const exact=explicit?jobs.filter(job=>[job.job_number,job.name].some(value=>text(value).toLowerCase()===explicit.toLowerCase())):[];
    const id=explicit?exact.length===1&&payload.has_more===false?text(exact[0].job_id):'':canonical.length===1?canonical[0]:'';
    if(explicit&&!found)output=calls([{name:'find_jobs',args:{query:explicit,statuses:[],include_archived:false,limit:20,cursor:''}}]);
    else if(!id)output=finish([],['Which exact Job number or full project name should this scripted review use?']);
    else{
     const details=compound?['get_job_summary','get_job_labor_summary']:labor?['get_job_labor_summary']:['get_job_planning'];
     const dates=[...question.matchAll(/\b\d{4}-\d\d-\d\d\b/g)].map(match=>match[0]);
     const start=dates.length===2?dates[0]:text(selection.startDate),end=dates.length===2?dates[1]:text(selection.endDate);
     const missing=details.filter(name=>!last(name));
     if(missing.length)output=calls(missing.map(name=>({name,args:{job_id:id,...(name==='get_job_labor_summary'?{start_date:start,end_date:end}:{})}})));
     else{
      const wanted=compound?['job_identity','job_schedule','open_follow_ups','labor_total','labor_limit']:labor?['job_identity','labor_total','labor_original','labor_rework_1','labor_limit']:['job_identity','job_status','job_schedule','job_requested_delivery','saved_delivery_comparison'];
      const observations=details.flatMap(name=>{const item=last(name)!;return records(item.data.answer_facts).filter(fact=>wanted.includes(text(fact.id))||/\bdays reported\b/.test(q)&&text(fact.id).startsWith('labor_day_')&&!/: 0 hours\./.test(text(fact.text))).map(fact=>({text:text(fact.text),evidence_ids:[item.evidence_id]}));});
      output=observations.length?finish(observations):finish([],['The scripted review could not verify those facts. Which exact Job should it use?']);
     }
    }
   }
   record({kind:'scripted-plan',calls:structuredClone(output.calls),outcome:output.final?'final':'calls'});return output;
  },
 };
 const handler=createHostedTenbot({owner:f.owner,origin,config:{enabled:true,origins:[origin],persistentHistory:true,modelDirectedReads:true,spendingAuthorized:false,apiKey:'',keyExpiresAt:''},caller:f.caller,service:f.service,jobTools,qwen,now:()=>f.state.now});
 const label=(value:unknown):unknown=>{
  if(!object(value))return value;
  return {...value,notices:[REVIEW_NOTICE,...(Array.isArray(value.notices)?value.notices:[])],...(Array.isArray(value.turns)?{turns:value.turns.map(turn=>object(turn)?{...turn,answer:label(turn.answer)}:turn)}:{}),...(Array.isArray(value.historyTurns)?{historyTurns:value.historyTurns.map(turn=>object(turn)?{...turn,answer:label(turn.answer)}:turn)}:{})};
 };
 return {...f,async ask(body:Record<string,unknown>){f.state.now=Date.now();return label(await handler(body));},status(){return {mode:'synthetic-scripted-read-orchestration',notice:REVIEW_NOTICE,liveInference:false,actualModelReasoning:false,operationalWrites:false,simulatedProviderSteps:scriptedSteps,actualInferenceTokens:0,actualInferenceCostUsd:0,conversationCount:f.rows.size,examples,syntheticRecords:[{jobNumber:target.job_number,name:target.name},{jobNumber:other.job_number,name:other.name}]};},traces:()=>structuredClone(trace)};
}

export function startTenbotReadOrchestrationReview(){
 const review=createTenbotReadOrchestrationReview();
 const server=createServer(async(req,res)=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,content-profile,accept-profile,x-client-info,x-supabase-api-version,prefer,range,range-unit','Access-Control-Allow-Methods':'GET,HEAD,POST,OPTIONS','Access-Control-Expose-Headers':'content-range'};
  const send=(status:number,value:unknown,extra={})=>{res.writeHead(status,{...headers,...extra});res.end(JSON.stringify(value));};
  if(!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host??'')||req.headers.origin&&req.headers.origin!==origin)return send(403,{message:'Local review only'});
  if(req.method==='OPTIONS')return send(204,null);
  const url=new URL(req.url!,'http://localhost:'+port);let body:Record<string,unknown>={};
  try{let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>32000)return send(413,{message:'Request too large'});}if(raw)body=JSON.parse(raw);}catch{return send(400,{message:'Invalid request'});}
  if(url.pathname==='/auth/v1/token'&&req.method==='POST')return send(200,reviewSession);
  if(req.headers.authorization!=='Bearer '+reviewSession.access_token)return send(401,{message:'Synthetic review session required'});
  if(url.pathname.startsWith('/auth/v1/'))return send(200,reviewSession.user);
  if(url.pathname==='/review/status'&&req.method==='GET')return send(200,review.status());
  if(url.pathname==='/review/traces'&&req.method==='GET')return send(200,{notice:REVIEW_NOTICE,traces:review.traces()});
  if(url.pathname==='/functions/v1/tenbot'&&req.method==='POST'){
   if(!['status','ask','history','clear'].includes(String(body.action)))return send(403,{error:'Only synthetic conversation review actions are available'});
   try{return send(200,await review.ask(body));}catch(error){return send(object(error)&&'status'in error?Number(error.status):500,{error:error instanceof Error?error.message:'Local review unavailable',notices:[REVIEW_NOTICE]});}
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1);
   if(name==='get_my_app_access')return send(200,[{user_id:review.owner,display_name:'Synthetic Read Orchestration Review',role:'developer',is_active:true,read_only:false,messaging_write:true}]);
   if(name==='get_my_account_preferences')return send(200,{});
   if(name?.startsWith('list_')||name?.startsWith('get_'))return send(200,[]);
   if(name==='ensure_my_welcome_notification')return send(200,null);
   return send(403,{message:'Operational writes are disabled in this review'});
  }
  if(url.pathname.startsWith('/rest/v1/')&&['GET','HEAD'].includes(req.method??'')){const result=wave2Response(url,{...review.tables,inventory_items:[],pending_receivals:[],account_notifications:[],app_users:[]});return send(200,result.rows,result.headers);}
  return send(403,{message:'Only synthetic review reads are available'});
 });
 server.listen(port,'localhost',()=>{mkdirSync(directory,{recursive:true});writeFileSync(directory+'/review-server.json',JSON.stringify({pid:process.pid,port,origin,apiUrl:'http://localhost:'+port,account:REVIEW_EMAIL,...review.status()},null,2)+'\n');console.log(REVIEW_NOTICE+'. Review: '+origin+'/my-work');});
 return server;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))startTenbotReadOrchestrationReview();
