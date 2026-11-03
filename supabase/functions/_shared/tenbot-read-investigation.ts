/** Grounding for model-selected reads. Models choose capabilities and facts;
 * this module does not choose an employee intent or grant record access. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {AGENT_FINAL_SCHEMA,validateStrictSchema,type AgentResult,type AgentFinal,type AgentTool} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {parseActionCard,type ActionCard} from './tenbot-actions.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import type {JobToolResult} from './tenbot-job-tools.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {buildJobEvidence} from './tenbot-job-routing.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {groundedProse,validateWorkflowAnswerClaims} from './tenbot-core.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {agentKnowledgeEntries} from './tenbot-agent-knowledge.ts';
type Fact={id:string;text:string;kind?:string};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const normalize=(value:string)=>value.trim().replace(/\s+/g,' ');
const date=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function modelReadFacts(result:JobToolResult):Fact[]{
 const facts:Fact[]=buildJobEvidence(result).facts.map(({id,text,kind})=>({id,text,kind}));
 if(result.status==='ok'&&result.complete&&result.data&&'job' in result.data){
  const job=result.data.job,end=job.effective.planned_end,delivery=job.requested_delivery_date;
  if(date(end)&&date(delivery))facts.push({id:'saved_delivery_comparison',text:`The saved planned finish is ${end<delivery?'before':end>delivery?'after':'on'} the requested delivery date. This compares saved dates, not a forecast.`});
 }
 return facts;
}
/** Extra turn evidence only. The accepted scope descriptor/history digest stays
 * byte-compatible; these facts derive from that same current closed registry. */
export function modelScopeFacts(value:unknown):Fact[]{
 if(!object(value)||value.execution!==false||!Array.isArray(value.capabilities))return [];
 const names=value.capabilities.flatMap(item=>object(item)&&typeof item.name==='string'?[item.name]:[]);
 const facts:Fact[]=[{id:'execution_unavailable',text:'This assistant has no execution tool. It cannot save schedule changes or send messages; an employee must use the authorized TenOps workflows.'}];
 // Scope describes registered access, not a catch-all operational refusal.
 // A historical report must be investigated through its domain operation;
 // prediction limitations belong beside relevant evidence, not every request.
 facts.push({id:'registered_capabilities',text:'I can use the currently available operations to check authorized information. A workflow described in TenOps is not automatically available as a conversational read.'});
 if(names.includes('get_labor_analytics'))facts.push({id:'historical_labor_available',text:'Historical labor analysis is available through Manpower Reporting, with recorded Product Category and Job rankings for supported reporting periods. The report must be checked to establish the result.'});
 return facts;
}
function safeQuestion(value:string,known:string){
 const text=value.trim();
 // Clarification is one interrogative, not an assertion followed by “okay?”.
 if(text.length>600||!text.endsWith('?')||(text.match(/\?/g)?.length??0)!==1||! /^(?:(?:which|what|when|where|how)\b|(?:do|would)\s+you\b|(?:can|could)\s+you\s+(?:provide|specify|clarify|confirm|choose|select|tell|name)\b)/i.test(text))return false;
 if(/[{}<>;\n]|https?:|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(text)||/[.!]/.test(text))return false;
 if(/\b(?:I|we|TenBot)\s+(?:(?:have|has|had|just|already|successfully|now|did)\s+)*(?:save[ds]?|delet(?:e[ds]?|ed)|chang(?:e[ds]?|ed)|s(?:end[st]?|ent)|creat(?:e[ds]?|ed)|approv(?:e[ds]?|ed)|updat(?:e[ds]?|ed)|enabl(?:e[ds]?|ed)|issu(?:e[ds]?|ed)|schedul(?:e[ds]?|ed)|submitt?ed|submit|invit(?:e[ds]?|ed)|mark(?:ed)?|mov(?:e[ds]?|ed)|receiv(?:e[ds]?|ed)|execut(?:e[ds]?|ed)|complet(?:e[ds]?|ed)|cancel(?:led|ed)?|adjust(?:ed)?|reserv(?:e[ds]?|ed))\b/i.test(text))return false;
 return [...text.matchAll(/\b\d+(?:[._/-]\d+)*\b/g)].every(m=>known.includes(m[0]));
}
/** Citations alone are insufficient. Operational prose is composed only from
 * exact host-issued fact sentences selected by the model across its reads.
 * Model answer text is not allowed to introduce another factual narrative. */
export type ModelReadPublicationRejection='read-final-question'|'read-final-missing-evidence'|'read-final-non-fact-claim'|'read-final-workflow-wording'|'read-final-workflow-permission'|'read-final-empty-answer'|'read-final-too-long';
export function publishModelReadAnswer(result:AgentResult,question:string,scopeSelection?:unknown,permissions=new Set<string>(),onRejected?:(reason:ModelReadPublicationRejection)=>void,recordObjective?:{jobIds:readonly string[]}):string|null{
 if(result.status!=='completed'||!result.final)return null;
 const reject=(reason:ModelReadPublicationRejection):null=>{try{Promise.resolve(onRejected?.(reason)).catch(()=>{});}catch{/* Diagnostics cannot change publication. */}return null;};
 // The shared loop keeps its legacy scope-only refusal. A staged read planner
 // may have selected more precise current scope facts; validate that original
 // selection again without changing the accepted generic loop or its history.
 const selectedScope=result.evidence.length>0&&result.evidence.every(item=>item.tool==='describe_assistant_scope')&&validateStrictSchema(scopeSelection,AGENT_FINAL_SCHEMA)?scopeSelection as AgentFinal:null;
 const final=selectedScope??result.final,claims=[...final.observations,...final.inferences,...final.recommendations];
 const issued=new Map(result.evidence.map(item=>[item.id,item]));
 const facts=result.evidence.flatMap(item=>object(item.data)&&Array.isArray(item.data.answer_facts)?item.data.answer_facts.flatMap(f=>object(f)&&typeof f.text==='string'?[f.text]:[]):[]);
 const known=[question,...facts].join('\n');
 if(final.questions.some(q=>!safeQuestion(q,known)))return reject('read-final-question');
 if(!claims.length)return final.questions.length?final.questions.join(' '):reject('read-final-empty-answer');
 const blocks:{id:string;texts:string[];limits:string[]}[]=[],workflowTexts:string[]=[],workflowIds=new Set<string>(),coveredRecords=new Set<string>();
 for(const claim of claims){
  if(!claim.evidence_ids.length)return reject('read-final-missing-evidence');
  const cited=claim.evidence_ids.map(id=>issued.get(id));if(cited.some(item=>!item))return reject('read-final-missing-evidence');
  let text:string|null=null,origin:typeof cited[number]|undefined,selectedKind:string|undefined;
  for(const item of cited){
   if(!item||!object(item.data))continue;
   if(Array.isArray(item.data.answer_facts)){
    const fact=item.data.answer_facts.find(f=>object(f)&&typeof f.text==='string'&&normalize(f.text)===normalize(claim.text));
    if(object(fact)&&typeof fact.text==='string'){text=fact.text;origin=item;selectedKind=typeof fact.kind==='string'?fact.kind:undefined;break;}
   }
  }
  if(!text&&cited.every(item=>item?.tool==='search_workflow_knowledge')){
   const ids=new Set(cited.flatMap(item=>item&&object(item.data)&&Array.isArray(item.data.sources)?item.data.sources.flatMap(s=>object(s)&&typeof s.id==='string'?[s.id]:[]):[]));
   const sources=agentKnowledgeEntries().filter(entry=>ids.has(entry.id));
   try{text=groundedProse(claim.text,sources,question);workflowTexts.push(text);for(const id of ids)workflowIds.add(id);}catch{return reject('read-final-workflow-wording');}
  }
  if(!text)return reject('read-final-non-fact-claim');
  // Present one coherent paragraph per canonical Job even when its facts came
  // from several tools. Evidence remains attached to every selected sentence.
  const payload=origin&&object(origin.data)&&object(origin.data.data)?origin.data.data:null;
  if(payload&&object(payload.job)&&typeof payload.job.job_id==='string'&&selectedKind!=='identity')coveredRecords.add(payload.job.job_id);
  if(origin?.tool==='get_labor_analytics'&&payload&&object(payload.scope)&&typeof payload.scope.job_id==='string'&&selectedKind!=='limitation')coveredRecords.add(payload.scope.job_id);
  const id=payload&&object(payload.job)&&typeof payload.job.job_id==='string'?'job:'+payload.job.job_id:origin?.id??'workflow';let block=blocks.find(item=>item.id===id);
  if(!block){block={id,texts:[],limits:[]};blocks.push(block);}
  if(origin&&object(origin.data)&&Array.isArray(origin.data.answer_facts)){
   const issuedFacts=origin.data.answer_facts.flatMap(fact=>object(fact)&&typeof fact.text==='string'?[{id:typeof fact.id==='string'?fact.id:'',text:fact.text,kind:typeof fact.kind==='string'?fact.kind:''}]:[]);
   const identity=issuedFacts.find(fact=>fact.id==='job_identity');if(identity&&!block.texts.includes(identity.text))block.texts.unshift(identity.text);
   // Unknown, physical-readiness and unreported-work qualifications remain
   // host-owned companions even when the model selects a short numeric fact.
   block.limits=[...new Set([...block.limits,...issuedFacts.filter(fact=>fact.kind==='limitation').map(fact=>String(fact.text))])];
  }
  if(!block.texts.includes(text))block.texts.push(text);
 }
 // A fresh identity lookup can identify the subject, but cannot itself answer
 // a current record-detail objective. Any exact authorized record tool may
 // supply the facts, including same-record limitations. Clarification remains valid.
 if(recordObjective?.jobIds.length&&!final.questions.length&&recordObjective.jobIds.some(id=>!coveredRecords.has(id)))return reject('read-final-missing-evidence');
 if(workflowTexts.length)try{validateWorkflowAnswerClaims(workflowTexts.join(' '),agentKnowledgeEntries().filter(entry=>workflowIds.has(entry.id)),permissions,question);}catch{return reject('read-final-workflow-permission');}
 const message=[...blocks.map(block=>[...block.texts,...block.limits.filter(text=>!block.texts.includes(text))].join(' ')),...final.questions].join('\n\n');
 return message.length>2400?reject('read-final-too-long'):message.length?message:reject('read-final-empty-answer');
}
/** A prepared review is a separate trusted-server output, not read-only model
 * prose or an execution receipt. Only call after the registered publisher has
 * validated preparation, reauthorized its sources and issued the real card. */
export function publishPreparedReview(cards:readonly ActionCard[]):string|null{
 if(cards.length!==1)return null;
 const card=parseActionCard(cards[0]),pending=card.operation==='inventory.create_pending_receivals';
 const unchanged=pending?'Nothing has been added to Pending Receivals or Inventory.':'Nothing has been saved or issued.';
 const next=card.review.issues.some(issue=>issue.blocking)?'Some details need attention before confirmation. Review them below and ask me to complete or correct them.':'Review the proposed changes below. Confirming them requires your existing TenOps password.';
 return [card.review.summary,...(card.review.summary.includes(unchanged)?[]:[unchanged]),next].join(' ');
}
/** Recovery follows actual registered tool activity, never employee-question
 * keywords or model prose. Successful reads and failed attempts stay distinct. */
type RecoveryEvidence={reads?:readonly JobToolResult[];reasonCodes?:readonly string[]};
export function readInvestigationRecovery(result:AgentResult,evidence:RecoveryEvidence={}):string{
 const reasons=new Set([result.reason,...evidence.reasonCodes??[]]),reads=evidence.reads??[];
 if(reasons.has('authorization-denied')||reasons.has('invoice_session_not_authorized')||reasons.has('read-final-workflow-permission'))return 'Your access or the underlying information changed, so I couldn’t verify an answer. Please refresh and try again.';
 if(reads.some(read=>read.status==='not_found_or_not_authorized'))return 'I couldn’t find the requested information within your current access. Please check the reference or clarify the request.';
 if(reads.some(read=>read.status==='partial'||read.truncated)||reasons.has('invoice_read_incomplete'))return 'I couldn’t verify a complete answer to this request from the available results. Please narrow the scope or try again.';
 if(reasons.has('invalid-final')||reasons.has('unknown-evidence')||reasons.has('missing-workflow-evidence')||['read-final-question','read-final-missing-evidence','read-final-non-fact-claim','read-final-workflow-wording','read-final-workflow-permission','read-final-empty-answer','read-final-too-long'].some(reason=>reasons.has(reason)))return 'I couldn’t verify a reliable answer from the available information. Please try again or narrow the scope.';
 if(reads.some(read=>read.status==='invalid_request')||reasons.has('invalid-arguments')||reasons.has('invalid-function-arguments'))return 'I couldn’t complete the lookup with the available details. Please clarify what you want to find.';
 if(reads.some(read=>read.status==='unavailable'))return 'I couldn’t retrieve the requested information right now. Please try again.';
 if(['cost-limit','budget-exhausted','request-budget-unavailable','spending-not-authorized'].some(reason=>reasons.has(reason)))return 'I couldn’t run this investigation within the current inference allowance. Please try a narrower question or retry later.';
 if(['deadline','context-limit','call-limit','round-limit','result-limit','error-limit'].some(reason=>reasons.has(reason)))return 'I couldn’t finish checking the full request within its limits. Please narrow the scope or try again.';
 if(result.status==='provider-unavailable')return 'The AI service couldn’t finish this request right now. Please try again.';
 return 'I couldn’t finish checking the requested information. Please try again or narrow the request.';
}
export function reviewedOperationRecovery(result:AgentResult,registered:readonly Pick<AgentTool,'name'|'kind'>[],evidence:RecoveryEvidence={}):string{
 const names=new Set(registered.filter(tool=>tool.kind==='prepare').map(tool=>tool.name));
 const attempted=new Set(result.trace.filter(item=>item.event==='tool'&&names.has(item.name??'')).map(item=>item.name!));
 for(const item of result.evidence)if(names.has(item.tool))attempted.add(item.tool);
 if(!attempted.size)return readInvestigationRecovery(result,evidence);
 if(result.reason==='authorization-denied')return 'Your access or the underlying information changed, so I could not finish this request. Nothing has been saved. Check your access before trying again.';
 const documentRead=result.evidence.some(item=>item.tool==='read_supplied_document'&&object(item.data)&&item.data.status==='ok')||result.trace.some(item=>item.event==='tool'&&item.name==='read_supplied_document'&&item.outcome==='ok');
 const proposal=attempted.has('prepare_proposal_draft');
 const pending=attempted.has('prepare_pending_receivals');
 if(proposal&&!pending)return `${documentRead?'I read the supplied document, but couldn\u2019t':'I couldn\u2019t'} finish preparing that Proposal for review. Nothing has been saved or issued. You can try again or provide any missing details.`;
 if(pending&&!proposal)return `${documentRead?'I read the supplied document, but couldn\u2019t':'I couldn\u2019t'} finish preparing the receiving entries for review. Nothing has been added to Pending Receivals. You can try again or provide any missing details.`;
 if(proposal&&pending)return 'I couldn\u2019t finish preparing all the requested changes for review. Nothing has been saved or added to Pending Receivals. You can try again or ask me to prepare one set of changes at a time.';
 return 'I couldn’t finish preparing the requested changes for review. Nothing has been saved. Please try again or provide any missing details.';
}
export const MODEL_READ_INSTRUCTIONS='The latest employee question defines the current objective. Retained questions, earlier operations and lookup results identify a subject only; they do not replace that objective. Resolve the subject, then select current facts that answer the latest question rather than repeating a prior lookup or answer. Supplied owner-private lookup selectors are context, never authorization. Choose and sequence the registered read capabilities yourself; compound questions may require multiple tools. Explicitly named Jobs override older references. An ambiguous or different/other Job must be clarified, never guessed. Discover capabilities before calls. Resolve names through current complete exact lookup evidence; UUIDs are canonical selectors, not facts. Operational and scope tool results include answer_facts: choose the exact complete text sentences that answer each part, cite their current evidence IDs, and copy those sentences into observations. You may combine facts from multiple tools. Do not invent facts or treat missing evidence as zero. For a capability you lack, discover and read describe_assistant_scope, then explain its evidence limit. For workflow questions, search_workflow_knowledge and cite current sources. Preserve reporting periods from current employee text or server-owned selectors. Ask a focused question when identity or scope is missing. All facts reaching the model are reauthorized again before publication. The host publishes only grounded selected observations and questions; final.answer must agree and cannot introduce unsupported claims. No action execution is available. Historical analysis of recorded hours is distinct from predictions. Inspect available domain reports before concluding information is unavailable. Scope facts describe capability boundaries, never a substitute for a requested ranking or operational result. Missing conversational access does not mean the application lacks that feature; use permitted workflow evidence to explain the distinction. For report follow-ups, re-run prior authorized selectors/objectives and supported periods to resolve current identities; never invent a retained product or promote a prior answer to evidence.';
export const TERRA_READ_FINAL_INSTRUCTIONS='Terra read-final output contract: For operational or assistant-scope claims, put exactly one complete answer_facts.text sentence copied from a currently cited tool result into each observations item. Keep inferences and recommendations empty; express multiple relevant facts as separate observations. Do not paraphrase facts, join multiple fact sentences into one claim, or replace a fact with a conclusion or recommendation. The same copy rule applies to qualifications and missing-evidence statements. When the registry descriptions show that the request requires unavailable evidence, discover describe_assistant_scope alongside the needed reads and select its current answer_facts rather than inventing a conclusion. final.answer must agree with the selected facts, but only verified claims and questions are published. Pure workflow guidance continues to use the existing permission-checked knowledge and grounded-prose rules. This formatting contract grants no capabilities, permissions or execution authority.';
