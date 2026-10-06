import {buildProductionBlend} from '../../../supabase/functions/_shared/production-blend.mjs';
/** Compare captured planning content, excluding issuance identity/timestamps. No persistence. */
export function productionSourceKey(snapshot:Parameters<typeof buildProductionBlend>[0]):string|null{
 try {const model=buildProductionBlend(snapshot,{batchCount:1,plannedQuantity:1,blendSize:1000});return JSON.stringify({...model,sourceUpdatedAt:null,sourceIssueNumber:null});}catch{return null;}
}
