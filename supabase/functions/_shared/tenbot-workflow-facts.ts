/** Granular projections of the maintained registry, not a second FAQ/router. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {knowledgeProofValue,type CapabilityEntry} from './tenbot-knowledge.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {statement,qualification,type ReadAnswerFact} from './tenbot-read-composition.ts';
export const workflowProofId=(entry:CapabilityEntry)=>'workflow-facts:'+entry.id;
export const workflowProofEntryId=(id:string)=>id.startsWith('workflow-facts:')?id.slice('workflow-facts:'.length):null;
export function workflowFacts(entry:CapabilityEntry,index:number):ReadAnswerFact[]{
 const definitions=entry.workflowFacts??[];
 if(definitions.length>8||new Set(definitions.map(f=>f.id)).size!==definitions.length)throw Error('Invalid workflow facts');
 for(const f of definitions){
  if(!/^[a-z][a-z0-9_]{0,39}$/.test(f.id)||!f.text.trim()||f.text.length>800||f.role!==undefined&&!['statement','qualification'].includes(f.role)||(f.requires??[]).length>4||(f.requires??[]).some(id=>!definitions.some(d=>d.id===id&&d.role==='qualification'))||f.role==='qualification'&&f.requires?.length)throw Error('Invalid workflow facts');
 }
 const id=(name:string)=>`workflow_${index}_${name}`;
 return definitions.map(f=>({...((f.role==='qualification')?qualification(id(f.id),`workflow:${entry.id}:${f.id}`,f.text):statement(id(f.id),f.text,(f.requires??[]).map(id),'workflow')),workflowSourceId:entry.id}));
}
/** Additive facts have their own versioned proof. Existing whole-guide history
 * keeps its original proof; new facts cannot outlive their own current text. */
export function workflowProofValue(entry:CapabilityEntry){workflowFacts(entry,0);return {base:knowledgeProofValue(entry),facts:entry.workflowFacts??[]};}
