// Rates verified against Cloudflare's public pricing table, October 27, 2026.
// https://developers.cloudflare.com/workers-ai/platform/pricing/
// Only these non-paid-only Workers AI models may enter the local comparison.
export const modelRates={
 '@cf/meta/llama-3.1-8b-instruct-fp8':{input:13778,output:26128},
 '@cf/meta/llama-3.3-70b-instruct-fp8-fast':{input:26668,output:204805},
 '@cf/qwen/qwen3-30b-a3b-fp8':{input:4625,output:30475},
} as const;
export type ModelId=keyof typeof modelRates;
export const allowedModels=Object.keys(modelRates) as ModelId[];
// Selected by the local 27-response quality/latency comparison, not price alone.
export const defaultModel:ModelId='@cf/qwen/qwen3-30b-a3b-fp8';
export const maxOutputTokens=640;
export const usagePolicy={sharedDayLimit:300,sharedMonthLimit:6000,perAccountMinuteLimit:6,dailyNeuronLimit:8000,monthlyNeuronLimit:240000,freeDailyNeurons:10000,neuronHeadroom:2000};
export function isAllowedModel(value:unknown):value is ModelId{return typeof value==='string'&&Object.hasOwn(modelRates,value);}
export type InferenceUsage={model:ModelId;inputTokens:number;outputTokens:number;estimatedNeurons:number};
export function measuredUsage(model:ModelId,value:unknown):InferenceUsage|null{
 if(!value||typeof value!=='object')return null;
 const inputTokens=(value as Record<string,unknown>).prompt_tokens,outputTokens=(value as Record<string,unknown>).completion_tokens;
 if(typeof inputTokens!=='number'||typeof outputTokens!=='number'||!Number.isSafeInteger(inputTokens)||!Number.isSafeInteger(outputTokens)||inputTokens<0||outputTokens<0||inputTokens>100000||outputTokens>maxOutputTokens)return null;
 const rate=modelRates[model];
 return {model,inputTokens,outputTokens,estimatedNeurons:Math.ceil((inputTokens*rate.input+outputTokens*rate.output)/1000)/1000};
}
export function reserveForRequest(model:ModelId,request:{messages:{content:string}[];max_tokens:number}){
 // One UTF-8 byte per input token is an intentionally conservative upper bound
 // for these byte-fallback tokenizers; 256 extra tokens cover chat framing.
 // Missing/invalid usage retains this reservation. No speculative refunds.
 const bytes=new TextEncoder().encode(JSON.stringify(request.messages)).byteLength+256;
 const rate=modelRates[model];
 return {model,neurons:Math.ceil((bytes*rate.input+request.max_tokens*rate.output)/1e6)};
}
