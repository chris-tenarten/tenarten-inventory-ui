/** Public, fixed canary scope. This is validation metadata, never permission or
 * an activation token. Current caller-JWT/database checks remain authoritative. */
export const TENBOT_CANARY_OWNER = '3785f6b9-742e-452f-af6c-31613a983633';
export const TENBOT_CANARY_DOCUMENT_SHA256 = 'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a';
export const TENBOT_CANARY_DOCUMENT_REFERENCE = 'SYN-TENDEV-RECEIVAL-20261030-01';
export const TENBOT_CANARY_CATALOG_ID = 'ba6a3690-0886-4f72-9f86-581bcc1f3b44';
export type TenbotCanaryAccess = {
 active: true; grantId: string; ownerId: typeof TENBOT_CANARY_OWNER;
 startsAt: string; expiresAt: string; serverNow: string;
 documentSha256: typeof TENBOT_CANARY_DOCUMENT_SHA256;
 documentReference: typeof TENBOT_CANARY_DOCUMENT_REFERENCE;
 supplier: 'T&M Supply'; catalogSource: 'standard'; catalogId: typeof TENBOT_CANARY_CATALOG_ID;
 quantityExpected: '1'; unit: 'Bag';
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const instant = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
/** Only the self-scoped server projection may enable the canary UI. A local
 * clock is not used to evaluate its initial duration; expiry remains a DB rule. */
export function parseTenbotCanaryAccess(value: unknown, owner: string): TenbotCanaryAccess | null {
 if (!record(value) || typeof value.active !== 'boolean' || !instant(value.serverNow)) throw Error('invalid_tenbot_canary_access');
 if (value.active === false) {if(Object.keys(value).some(key=>!['active','serverNow'].includes(key)))throw Error('invalid_tenbot_canary_access');return null;}
 const fields=['active','grantId','ownerId','startsAt','expiresAt','serverNow','documentSha256','documentReference','supplier','catalogSource','catalogId','quantityExpected','unit'];
 if(Object.keys(value).length!==fields.length||Object.keys(value).some(key=>!fields.includes(key)))throw Error('invalid_tenbot_canary_access');
 if (owner !== TENBOT_CANARY_OWNER || value.ownerId !== owner || typeof value.grantId !== 'string' || !uuid.test(value.grantId)
  || !instant(value.startsAt) || !instant(value.expiresAt)
  || Date.parse(value.startsAt as string) > Date.parse(value.serverNow as string)
  || Date.parse(value.expiresAt as string) <= Date.parse(value.serverNow as string)
  || Date.parse(value.expiresAt as string) - Date.parse(value.startsAt as string) > 15 * 60 * 1000
  || value.documentSha256 !== TENBOT_CANARY_DOCUMENT_SHA256 || value.documentReference !== TENBOT_CANARY_DOCUMENT_REFERENCE
  || value.supplier !== 'T&M Supply' || value.catalogSource !== 'standard' || value.catalogId !== TENBOT_CANARY_CATALOG_ID
  || value.quantityExpected !== '1' || value.unit !== 'Bag') throw Error('invalid_tenbot_canary_access');
 return value as TenbotCanaryAccess;
}
export function tenbotCanaryRemainingMs(access: TenbotCanaryAccess): number {
 return Date.parse(access.expiresAt) - Date.parse(access.serverNow);
}
export function tenbotCanaryDocumentMatches(access: TenbotCanaryAccess, document: {sha256: string; supplier?: string; reference?: string}): boolean {
 return document.sha256 === access.documentSha256
  && (document.supplier === undefined || document.supplier === access.supplier)
  && (document.reference === undefined || document.reference === access.documentReference);
}
/** This early check improves feedback; the canonical SQL independently checks
 * the immutable approved payload and single execution even on direct RPC use. */
export function tenbotCanaryDraftMatches(access: TenbotCanaryAccess, draft: {ownerId: string; document: {sha256: string; supplier: string; reference: string}; lines: {catalogSource: string|null; catalogId: string|null; quantityExpected: string; unit: string; productionJobId: string|null; newMaterial: unknown}[]}): boolean {
 const line = draft.lines[0];
 return draft.ownerId === access.ownerId && tenbotCanaryDocumentMatches(access, draft.document) && draft.lines.length === 1
  && line.catalogSource === access.catalogSource && line.catalogId === access.catalogId
  && /^1(?:\.0{1,6})?$/.test(line.quantityExpected) && line.unit === access.unit
  && line.productionJobId === null && line.newMaterial === null;
}
export function tenbotCanaryEditsMatch(access: TenbotCanaryAccess, edits: unknown): boolean {
 if(!Array.isArray(edits)||!edits.every(record))return false;
 const included=edits.filter(row=>row.excluded!==true),line=included[0];
 return included.length===1&&line.excluded===false&&line.materialId===access.catalogSource+':'+access.catalogId
  &&typeof line.quantity==='string'&&/^1(?:\.0{1,6})?$/.test(line.quantity)&&line.unit===access.unit
  &&line.jobId===null&&line.catalogRequest==null;
}
