/** Canary-only meter adapter. Ordinary conversations retain the existing meter.
 * Scope comes from fresh caller authorization and verified private bytes, never
 * from a model tool argument or a request opt-in flag. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit extension required by Edge bundling.
import {createHostedOpenAIMetering,HostedMeteringError,type HostedMeterOptions} from './tenbot-openai-metering.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit extension required by Edge bundling.
import {parseTenbotCanaryFunding,tenbotCanaryFundingWindowOpen,type TenbotCanaryFunding} from '../../../src/modules/inventory/tenbot-canary-funding.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit extension required by Edge bundling.
import {TENBOT_CANARY_OWNER,type TenbotCanaryAccess} from '../../../src/modules/inventory/tenbot-canary-access.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit extension required by Edge bundling.
import type {InvoiceReceivalCaller} from '../../../src/modules/inventory/invoice-receival-service.ts';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function readHostedCanaryFunding(caller:InvoiceReceivalCaller):Promise<TenbotCanaryFunding>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{const result=await Promise.race([Promise.resolve(caller.rpc('get_tenbot_chris_dev_canary_funding_status',{})),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000);})]);if(result.error)throw Error('unavailable');return parseTenbotCanaryFunding(result.data);}
 catch{throw new HostedMeteringError('meter-unavailable');}finally{if(timer)clearTimeout(timer);}
}
export function assertHostedCanaryFunding(funding:TenbotCanaryFunding,access:TenbotCanaryAccess,now:number){
 if(!funding.active||!tenbotCanaryFundingWindowOpen(funding)||funding.grantId!==access.grantId||access.ownerId!==TENBOT_CANARY_OWNER||!Number.isFinite(now)||!funding.expiresAt||Date.parse(funding.expiresAt)<=now||Date.parse(access.expiresAt)>Date.parse(funding.expiresAt))throw new HostedMeteringError('meter-unavailable');
}
export function createHostedCanaryMetering(options:HostedMeterOptions&{origin:string;scope:()=>Promise<{sourceId:string;grantId:string}>}){
 if(options.owner!==TENBOT_CANARY_OWNER||options.origin!=='https://tendev.pages.dev'||options.model!=='gpt-6.1-terra')throw new HostedMeteringError('invalid-meter-configuration');
 return createHostedOpenAIMetering({...options,async rpc(name,args){
  if(name==='tenbot_openai_reserve'){
   const scope=await options.scope();if(!uuid.test(scope.sourceId)||!uuid.test(scope.grantId))throw new HostedMeteringError('meter-unavailable');
   return options.rpc('tenbot_openai_canary_reserve',{...args,p_origin:options.origin,p_source_id:scope.sourceId,p_grant_id:scope.grantId});
  }
  // Settlement is deliberately not gated by the current window/grant. A paid
  // request dispatched just before expiry must still record its actual charge.
  if(name==='tenbot_openai_settle')return options.rpc('tenbot_openai_canary_settle',args);
  throw new HostedMeteringError('meter-unavailable');
 }});
}
