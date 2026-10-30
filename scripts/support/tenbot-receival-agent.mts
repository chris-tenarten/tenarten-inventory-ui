// Thin local adapter; the accepted controller is shared with the hosted entry.
import {createAuthenticatedReceivalAgent as createRuntime,type ReceivalRuntimeDependencies} from '../../supabase/functions/_shared/tenbot-receival-runtime';
import {decodeInvoiceAttachment,extractInvoiceDocument} from './tenbot-invoice-attachment.mjs';
import {extractOriginalInvoiceDocument} from '../../supabase/functions/_shared/tenbot-invoice-extraction';
export type {ReceivalAgentCaller} from '../../supabase/functions/_shared/tenbot-receival-runtime';
export function createAuthenticatedReceivalAgent(deps:Omit<ReceivalRuntimeDependencies,'decodeAttachment'|'extractDocument'>){return createRuntime({...deps,decodeAttachment:decodeInvoiceAttachment,extractDocument:async input=>{
 if(deps.sourceStore)return extractOriginalInvoiceDocument(input);
 if(input.image.mediaType==='application/pdf')throw Error('Native originals require private source retention.');
 return extractInvoiceDocument({...input,image:{bytes:Buffer.from(input.image.bytes),mediaType:input.image.mediaType}});
}});}
