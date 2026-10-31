/** Safe, caller-scoped projection of the one-attempt canary allowance.
 * This module has no activation, credential, mutation or ordinary-budget API. */
export const TENBOT_CANARY_FUNDING_BUDGET_MICROUSD=250000;
export type TenbotCanaryFunding={schemaVersion:'tenbot-canary-funding.v1';serverNow:string;enabled:boolean;startsAt:string|null;expiresAt:string|null;fundingId:string;grantId:string|null;budgetMicrousd:250000;accountedMicrousd:number;remainingMicrousd:number;active:boolean};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const time=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function parseTenbotCanaryFunding(value:unknown):TenbotCanaryFunding{
 const fail=()=>{throw Error('invalid-canary-funding-status');};
 if(value===null||typeof value!=='object'||Array.isArray(value))return fail();
 const v=value as Record<string,unknown>,keys=['schemaVersion','serverNow','enabled','startsAt','expiresAt','fundingId','grantId','budgetMicrousd','accountedMicrousd','remainingMicrousd','active'];
 if(Object.keys(v).length!==keys.length||Object.keys(v).some(key=>!keys.includes(key))||v.schemaVersion!=='tenbot-canary-funding.v1'||!time(v.serverNow)||typeof v.enabled!=='boolean'||typeof v.active!=='boolean'||!uuid.test(String(v.fundingId))||!(v.grantId===null||uuid.test(String(v.grantId)))||v.budgetMicrousd!==TENBOT_CANARY_FUNDING_BUDGET_MICROUSD||!Number.isSafeInteger(v.accountedMicrousd)||Number(v.accountedMicrousd)<0||!Number.isSafeInteger(v.remainingMicrousd)||v.remainingMicrousd!==Math.max(0,TENBOT_CANARY_FUNDING_BUDGET_MICROUSD-Number(v.accountedMicrousd)))return fail();
 if(v.startsAt===null||v.expiresAt===null){if(v.startsAt!==null||v.expiresAt!==null||v.enabled||v.active||v.grantId!==null)return fail();}
 else if(!time(v.startsAt)||!time(v.expiresAt)||Date.parse(v.expiresAt)<=Date.parse(v.startsAt)||Date.parse(v.expiresAt)-Date.parse(v.startsAt)>900000)return fail();
 const parsed=value as TenbotCanaryFunding;
 // A configured window may await its new grant. Active additionally means the
 // database verified the exact bound grant; the browser cannot create that fact.
 if(parsed.active&&(!tenbotCanaryFundingWindowOpen(parsed)||parsed.grantId===null))return fail();
 return parsed;
}
/** Use the observed server clock plus elapsed monotonic time, never a stale
 * hardcoded deadline or an employee's editable workstation clock. Remaining
 * funds gate new reservations/activation, not an already-reserved dispatch or
 * deterministic approval; consuming the final micros must not self-revoke. */
export function tenbotCanaryFundingWindowOpen(value:TenbotCanaryFunding,elapsedMs=0):boolean{
 if(!Number.isFinite(elapsedMs)||elapsedMs<0||!value.enabled||value.startsAt===null||value.expiresAt===null)return false;
 const now=Date.parse(value.serverNow)+elapsedMs;
 return Number.isFinite(now)&&Date.parse(value.startsAt)<=now&&now<Date.parse(value.expiresAt);
}
