// This boundary governs provenance and controlled persistence, not semantic DLP.
// Explicitly submitted text may contain business/personal context. It is sent
// only to the configured provider for this authenticated user's requested answer.
const modules=new Set(['TenOps','Production','Rework','Planning','My Work','Settings','Contacts','Intake','Samples','Proposals','Inventory','Purchasing','Manpower Reporting']);
export function projectConversation(question:string,context:string[]):{question:string;context:string[]}{
 return {question:question.trim(),context:context.filter(item=>item.startsWith('Current module: ')&&modules.has(item.slice('Current module: '.length))).slice(0,1)};
}
export function validModuleContext(context:unknown):boolean{
 return context===undefined||Array.isArray(context)&&context.length<=1&&context.every(item=>typeof item==='string'&&projectConversation('',[item]).context.length===1);
}
export function safeText(value:unknown,max:number,required=true):value is string{
 return typeof value==='string'&&value.length<=max&&(!required||Boolean(value.trim()))&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
// Output/feedback validation deliberately permits ordinary business and personal
// wording. It rejects executable/diagnostic envelopes and obvious credential
// values; it does not claim to identify all private meaning.
export function validSummary(value:unknown):value is string{
 return safeText(value,800,false)&&!/(?:https?:\/\/|www\.|<[^>]*>|-----BEGIN|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.|\b(?:sk-|sb_secret_)[A-Za-z0-9_-]{12,}|\b(?:password|passwd|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|client[ _-]?secret)\s*(?:[:=]\s*[A-Za-z0-9_\/-]{8,}|\s+[A-Za-z0-9]*[-_/][A-Za-z0-9_\/-]{6,}))/i.test(value);
}
export function validFeedbackDraft(value:unknown):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const draft=value as Record<string,unknown>,fields=['capability','problem','desired','module','original','summary','summaryKind','context'];
 return Object.keys(draft).every(key=>fields.includes(key))&&fields.every(key=>key in draft)
  &&['capability','problem','desired','module','original'].every(key=>safeText(draft[key],1200))
  &&safeText(draft.context,1200,false)&&validSummary(draft.summary)
  &&['AI-generated','Employee-written'].includes(String(draft.summaryKind))&&JSON.stringify(draft).length<=10000;
}
export function serverConversationContext(turns:{question:string;answer:string}[]):string[]{
 let previous='';
 for(const turn of turns.slice(-2).reverse()){
  const exchange=`Employee: ${turn.question.slice(0,400)}\nTenBot: ${turn.answer.slice(0,600)}`;
  const next=previous?exchange+'\n'+previous:exchange;
  if(next.length+23<=1100)previous=next;
 }
 return previous?['Conversation context:\n'+previous]:[];
}
