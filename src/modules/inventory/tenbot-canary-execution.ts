/** Public fixed-scope status only. This module cannot arm a window, grant
 * permission, fund inference, approve a draft or execute an Inventory write. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- explicit extension is required by Edge bundling.
// @ts-ignore -- shared Node/Deno source uses an explicit local extension.
import {TENBOT_CANARY_OWNER,TENBOT_CANARY_DOCUMENT_SHA256} from './tenbot-canary-access.ts';

export const TENBOT_CANARY_EXECUTION_SOURCE_ID='1423d4e0-1a4a-48bd-af79-28e623102da4';
export const TENBOT_CANARY_EXECUTION_SOURCE_EVIDENCE_SHA256='534087aeed62e2dd4d7112e22d700b760eb0f436445de16d300fc3ca83ad7c54';
export const TENBOT_CANARY_EXECUTION_PREVIEW_REVISION=1;
export const TENBOT_CANARY_EXECUTION_PREVIEW_HASH='7b63a8b55d2d496c2e15d0d5f2af81fb8da06f81109c4da1dfeed89e0c8e7594';
export type TenbotCanaryExecutionWindow={
 schemaVersion:'tenbot-canary-execution.v1';serverNow:string;enabled:boolean;
 startsAt:string|null;expiresAt:string|null;ownerId:typeof TENBOT_CANARY_OWNER;
 sourceId:typeof TENBOT_CANARY_EXECUTION_SOURCE_ID;documentSha256:typeof TENBOT_CANARY_DOCUMENT_SHA256;
 previewRevision:typeof TENBOT_CANARY_EXECUTION_PREVIEW_REVISION;
 previewHash:typeof TENBOT_CANARY_EXECUTION_PREVIEW_HASH;
 sourceEvidenceSha256:typeof TENBOT_CANARY_EXECUTION_SOURCE_EVIDENCE_SHA256;
 grantId:string|null;inferenceAllowed:false;
};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const time=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function parseTenbotCanaryExecutionWindow(value:unknown):TenbotCanaryExecutionWindow{
 const fail=()=>{throw Error('invalid-canary-execution-window');};
 if(value===null||typeof value!=='object'||Array.isArray(value))return fail();
 const v=value as Record<string,unknown>,keys=['schemaVersion','serverNow','enabled','startsAt','expiresAt','ownerId','sourceId','documentSha256','previewRevision','previewHash','sourceEvidenceSha256','grantId','inferenceAllowed'];
 if(Object.keys(v).length!==keys.length||Object.keys(v).some(key=>!keys.includes(key))||v.schemaVersion!=='tenbot-canary-execution.v1'||!time(v.serverNow)||typeof v.enabled!=='boolean'
  ||v.ownerId!==TENBOT_CANARY_OWNER||v.sourceId!==TENBOT_CANARY_EXECUTION_SOURCE_ID||v.documentSha256!==TENBOT_CANARY_DOCUMENT_SHA256||v.previewRevision!==TENBOT_CANARY_EXECUTION_PREVIEW_REVISION||v.previewHash!==TENBOT_CANARY_EXECUTION_PREVIEW_HASH||v.sourceEvidenceSha256!==TENBOT_CANARY_EXECUTION_SOURCE_EVIDENCE_SHA256||v.inferenceAllowed!==false||!(v.grantId===null||uuid.test(String(v.grantId))))return fail();
 if(v.startsAt===null||v.expiresAt===null){if(v.startsAt!==null||v.expiresAt!==null||v.enabled||v.grantId!==null)return fail();}
 else if(!time(v.startsAt)||!time(v.expiresAt)||Date.parse(v.expiresAt)<=Date.parse(v.startsAt)||Date.parse(v.expiresAt)-Date.parse(v.startsAt)>900000)return fail();
 return value as TenbotCanaryExecutionWindow;
}
/** Initial authorization uses the observed server clock; elapsed monotonic time
 * keeps an old browser projection from extending this finite execution window. */
export function tenbotCanaryExecutionWindowOpen(value:TenbotCanaryExecutionWindow,elapsedMs=0):boolean{
 if(!Number.isFinite(elapsedMs)||elapsedMs<0||!value.enabled||value.startsAt===null||value.expiresAt===null||value.inferenceAllowed!==false)return false;
 const now=Date.parse(value.serverNow)+elapsedMs;
 return Number.isFinite(now)&&Date.parse(value.startsAt)<=now&&now<Date.parse(value.expiresAt);
}
