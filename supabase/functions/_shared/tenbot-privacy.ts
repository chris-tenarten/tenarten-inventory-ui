// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import {registry} from './tenbot-knowledge.ts';

const modules=new Set(['TenOps','Production','Rework','Planning','My Work','Settings','Contacts','Intake','Samples','Proposals','Inventory','Purchasing','Manpower Reporting']);
const intentWords=new Set(('a an the i me my mine we us our ours you your yours he she it its they them their this that these those '+
 'am is are was were be been being do does did have has had can cannot could should would will may might must '+
 'not no yes or and but if then than as at by for from in into of off on onto out over through to under up with without '+
 'how what where when why which who whose whether about after again all also already another any anyone anything '+
 'before between both each either else even ever every first second third fourth last less many more most much neither '+
 'never next once one only other otherwise same some still such there too two until while yet '+
 'actually automatic automatically automate automation available availability basic begin button buttons change changing clarify clarification concise confirm continue '+
 'delete remove export import predict forecast automate sync train invite approve '+
 'control controls describe description detail details different difference directly dont enable enabled enabling '+
 'example explain explanation export exporting feature features follow followup forecast forecasting get getting go goes going help hidden import importing instead integrate integration '+
 'know known lack lacks lacking meant mean means missing need needed needs neither new normally open opening '+
 'option options otherwise please possible predict predicting prediction previous question questions rather really recommend recommendation repeat repeating request requests draft drafting like reset retry return '+
 'see seeing select selecting selection separate show showing simplest start step steps supported supporting '+
 'tell there thing things trying turn unavailable unclear understand unknown unsupported use uses using want wants '+
 'way ways workflow workflows work works working visible').split(/\s+/));
// Public workflow vocabulary preserves employee intent without accepting an
// arbitrary dictionary. It deliberately excludes provenance/evidence paths.
const vocabulary=new Set(registry.flatMap(entry=>(entry.title+' '+entry.terms+' '+entry.guidance+' '+entry.path).toLowerCase().match(/[a-z]+/g)||[]));
const secret=/\b(?:authorization|bearer|password|passwd|credentials?|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|service[ _-]?role|client[ _-]?secret|private[ _-]?key|secret)\b|-----BEGIN|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./i;
const pastedMessage=/\b(?:employee|customer|client|private|direct|dm|group|inbox)\s+(?:message|conversation|transcript)\s*[:=]|\b(?:said|wrote)\s*[:=]/i;
const structured=/[{}\[\]<>|\t]|(?:^|[\n;,])\s*[a-z_][a-z0-9_ -]{0,35}\s*[:=]\s*\S/i;

function projectText(value:string,assistantProse=false){
 if(value.length>1200||secret.test(value)||pastedMessage.test(value))return '';
 // Own TenBot prose may use a breadcrumb separator. Normalize that narrow
 // punctuation before record-shape checks; questions retain strict rejection.
 let text=(assistantProse?value.replace(/([a-z])\s*>\s*(?=[a-z])/gi,'$1 '):value)
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,' ')
  .replace(/\b(?:https?:\/\/|www\.)\S+/gi,' ')
  .replace(/(?:^|\s)\/\S+/g,' ')
  .replace(/(?:^|\s)(?:"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’)/g,' ');
 if(structured.test(text))return '';
 // Explicit named operands and conventional proper-name positions are not
 // workflow intent, including names that happen to be ordinary allowed words.
 text=text
  .replace(/\b(?:named|called)\s+[^?.,;\n]+/gi,' ')
  .replace(/\b(customer|company|client|employee|worker|participant|contact)\s+([A-Z][A-Za-z’'-]*(?:\s+[A-Z][A-Za-z’'-]*){0,4})/g,'$1 ')
  .replace(/\b[a-z0-9_.-]*\d[a-z0-9_.-]*\b/gi,' ')
  .replace(/[’‘]/g,"'")
  .replace(/\bcan't\b/gi,'cannot').replace(/\bwon't\b/gi,'will not')
  .replace(/\b([a-z]+)n't\b/gi,'$1 not').replace(/\bI'm\b/gi,'i am')
  .replace(/\b(it|that|there|what)'s\b/gi,'$1 is')
  .toLowerCase();
 const words=text.match(/\b[a-z]+\b/g)||[];
 return words.filter(word=>intentWords.has(word)||vocabulary.has(word)).slice(0,160).join(' ');
}

function projectExchange(value:string){
 if(!value.startsWith('Conversation context:\n')||value.length>1200)return '';
 const turns=value.slice('Conversation context:\n'.length).split(/\n(?=(?:Employee|TenBot):)/);
 if(![2,4].includes(turns.length))return '';
 const result:string[]=[];
 for(let index=0;index<turns.length;index+=2){
  const employee=/^Employee: ?([\s\S]*)$/.exec(turns[index]);
  const assistant=/^TenBot: ?([\s\S]*)$/.exec(turns[index+1]);
  if(!employee||!assistant)return '';
  const question=projectText(employee[1]),reply=projectText(assistant[1],true);
  if(question&&reply)result.push(`Employee: ${question}`,`TenBot: ${reply}`);
 }
 return result.length?'Conversation context:\n'+result.join('\n'):'';
}

/**
 * Minimize an actual workflow question and bounded, own-assistant context.
 * Empty questions must use local guidance, never a provider call. This is a
 * vocabulary/shape privacy guard, not a semantic classifier: a private phrase
 * made solely of ordinary workflow words is indistinguishable from intent.
 * Callers must supply only this account's assistant turns, never Inbox data.
 */
export function projectConversation(question:string,context:string[]):{question:string;context:string[]}{
 const projected:string[]=[];
 for(const item of context.slice(-2)){
  if(item.startsWith('Current module: ')&&modules.has(item.slice('Current module: '.length))){
   projected.push(item);continue;
  }
  const exchange=projectExchange(item);
  if(exchange)projected.push(exchange);
 }
 return {question:projectText(question),context:projected};
}
