/** Qwen transport for the existing bounded agent loop. No access or execution
 * authority is supplied by this adapter; every inference uses the existing
 * shared free-pool reservation and provider-owned measurement contracts. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node module.
// @ts-ignore -- explicit Edge extension.
import {AgentStepError,emptyUsage,isJsonValue,type AgentProvider,type AgentStep,type AgentStepRequest,type AgentUsage,type JsonValue} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node module.
// @ts-ignore -- explicit Edge extension.
import type {InferenceInput,InferenceProvider} from './tenbot-core.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node module.
// @ts-ignore -- explicit Edge extension.
import {defaultModel,maxOutputTokens,isAllowedModel,type InferenceUsage} from './tenbot-models.ts';

type Rpc=(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sameKeys=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
function measured(provider:InferenceProvider,input:InferenceInput):InferenceUsage|null{
 let value:InferenceUsage|null=null;try{value=provider.usage?.(input)??null;}catch{return null;}
 return value&&value.model===defaultModel&&Number.isSafeInteger(value.inputTokens)&&value.inputTokens>=0&&value.inputTokens<=100000&&Number.isSafeInteger(value.outputTokens)&&value.outputTokens>=0&&value.outputTokens<=maxOutputTokens&&Number.isFinite(value.estimatedNeurons)&&value.estimatedNeurons>=0?value:null;
}
function usage(value:InferenceUsage|null):AgentUsage{return value?{inputTokens:value.inputTokens,cachedInputTokens:0,outputTokens:value.outputTokens,costUsd:0,reservedUsd:0}:emptyUsage();}
function parseStep(raw:unknown,measuredUsage:AgentUsage):AgentStep{
 if(!object(raw)||!sameKeys(raw,['calls','final'])||!Array.isArray(raw.calls)||raw.calls.length>4||!isJsonValue(raw))throw new AgentStepError('invalid-provider-step',measuredUsage);
 if(raw.calls.length?(raw.final!==null):(raw.final===null||!object(raw.final)))throw new AgentStepError('invalid-provider-step',measuredUsage);
 const calls=raw.calls.map(value=>{
  if(!object(value)||!sameKeys(value,['id','name','arguments'])||typeof value.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(value.id)||typeof value.name!=='string'||!/^[a-z][a-z0-9_]{1,63}$/.test(value.name)||!object(value.arguments)||!isJsonValue(value.arguments))throw new AgentStepError('invalid-provider-step',measuredUsage);
  return {id:value.id,name:value.name,arguments:value.arguments as Record<string,JsonValue>};
 });
 return {calls,...(raw.final===null?{}:{final:raw.final}),continuation:[raw as JsonValue],usage:measuredUsage};
}

export function createQwenAgentProvider(options:{provider:InferenceProvider;owner:string;rpc:Rpc;can():Promise<boolean>}):AgentProvider{
 const {provider,owner,rpc,can}=options;
 return {name:provider.name,model:defaultModel,async step(request:AgentStepRequest){
  const input:InferenceInput={question:'Bounded read-only capability investigation',context:[],excerpts:[],draft:false,agent:{instructions:request.instructions,history:request.history,tools:request.tools,finalSchema:request.finalSchema,maxOutputTokens:request.maxOutputTokens}};
  if(request.signal.aborted)throw new AgentStepError('provider-cancelled');
  if(!Number.isSafeInteger(request.maxOutputTokens)||request.maxOutputTokens<=0)throw new AgentStepError('invalid-output-budget');
  if(new TextEncoder().encode(JSON.stringify(input)).byteLength>160000)throw new AgentStepError('oversized-request');
  if(!await can())throw new AgentStepError('authorization-denied');
  const estimate=provider.reserveEstimate?.(input);
  if(!estimate||!isAllowedModel(estimate.model)||estimate.model!==defaultModel||!Number.isFinite(estimate.neurons)||estimate.neurons<=0)throw new AgentStepError('request-budget-unavailable');
  let reservation:string|null=null,finishAttempted=false;
  const finish=async(outcome:'completed'|'failed')=>{
   // A failed/uncertain settlement is deliberately not retried. The ledger's
   // original reservation remains conservative when measurements are absent.
   finishAttempted=true;const value=measured(provider,input);
   const result=await rpc('tenbot_finish_usage',{p_id:reservation,p_outcome:outcome,p_model:estimate.model,p_input_tokens:value?.inputTokens??null,p_output_tokens:value?.outputTokens??null,p_estimated_neurons:value?.estimatedNeurons??null});
   if(result.error)throw new AgentStepError('request-budget-unavailable',usage(value));
  };
  try{
   const admitted=await rpc('tenbot_reserve_usage',{p_user:owner,p_model:estimate.model,p_reserved_neurons:estimate.neurons});
   if(admitted.error||typeof admitted.data!=='string'||!uuid.test(admitted.data))throw new AgentStepError('request-budget-unavailable');
   reservation=admitted.data;
   if(request.signal.aborted)throw new AgentStepError('provider-cancelled');
   if(!await can())throw new AgentStepError('authorization-denied');
   const raw=await provider.infer(input,request.signal),value=measured(provider,input);
   if(!value)throw new AgentStepError('missing-provider-usage');
   if(value.outputTokens>Math.min(maxOutputTokens,request.maxOutputTokens))throw new AgentStepError('invalid-usage',usage(value));
   const step=parseStep(raw,usage(value));
   if(request.signal.aborted)throw new AgentStepError('provider-cancelled',step.usage);
   await finish('completed');return step;
  }catch(error){
   const value=measured(provider,input);
   if(reservation&&!finishAttempted){try{await finish('failed');}catch{throw new AgentStepError('request-budget-unavailable',usage(value));}}
   if(error instanceof AgentStepError)throw new AgentStepError(error.code,usage(value));
   throw new AgentStepError('provider-error',usage(value));
  }
 }};
}
