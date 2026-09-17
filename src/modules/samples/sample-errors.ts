import {calculateSampleFormulation} from './formulation';
import type {SampleRecord} from './types';

export type SampleOperation='save-draft'|'save-version'|'working-pdf'|'issued-pdf'|'restore-version'|'duplicate'|'delete-draft'|'delete-issued'|'formal-issue'|'catalog'|'load';
export type SampleErrorKind='validation'|'permission'|'conflict'|'not-found'|'immutable'|'calculation-incomplete'|'catalog-invalid'|'pdf-generation'|'network'|'unknown';
export type SampleActionError={kind:SampleErrorKind;title:string;message:string;guidance:string;safeState:string;retrySafe:boolean;diagnostic:{operation:SampleOperation;code:string;rawMessage:string;raw:unknown}};

const titleByOperation:Record<SampleOperation,string>={'save-draft':'Draft not saved','save-version':'Version not saved','working-pdf':'Working PDF could not be generated','issued-pdf':'Issued PDF could not be generated','restore-version':'Version not restored','duplicate':'Sample not duplicated','delete-draft':'Draft not deleted','delete-issued':'Issued Sample not deleted','formal-issue':'Sample not issued','catalog':'Catalog material unavailable','load':'Samples could not be loaded'};
const safeByOperation:Record<SampleOperation,string>={'save-draft':'Your previously saved Draft remains unchanged.','save-version':'Current Draft remains available; no working-version checkpoint was created.','working-pdf':'No Working PDF was created.','issued-pdf':'The issued snapshot remains unchanged.','restore-version':'The saved version remains unchanged, and Current Draft was not replaced.','duplicate':'No duplicate Sample was created.','delete-draft':'The Sample Draft was not deleted.','delete-issued':'Review the error before retrying; any reported PDF cleanup may already have occurred.','formal-issue':'No issued Sample Work Order was created.','catalog':'Your existing material row was not replaced.','load':'No Sample data was changed.'};
const details=(error:unknown)=>{const record=(typeof error==='object'&&error!==null?error:{}) as {code?:unknown;message?:unknown;details?:unknown;hint?:unknown;status?:unknown};const message=error instanceof Error?error.message:String(record.message??error??'');return{code:String(record.code??record.status??''),rawMessage:[message,record.details,record.hint].filter(Boolean).join(' · ')};};
const result=(operation:SampleOperation,error:unknown,kind:SampleErrorKind,message:string,guidance:string,retrySafe=false):SampleActionError=>{const raw=details(error);return{kind,title:titleByOperation[operation],message,guidance,safeState:safeByOperation[operation],retrySafe,diagnostic:{operation,code:raw.code,rawMessage:raw.rawMessage,raw:error}};};

export function translateSampleError(error:unknown,operation:SampleOperation):SampleActionError{
 const {code,rawMessage}=details(error);const lower=rawMessage.toLowerCase();
 if(lower.includes('prepared by'))return result(operation,error,'validation','Prepared By is required for formal issuance.','Select or confirm Prepared By, then try again.');
 if(lower.includes('color plate')||lower.includes('tyy-nnnl'))return result(operation,error,'validation','The Color Plate number is not valid.','Use the TYY-NNNL format, for example T26-123A.');
 if(lower.includes('ratio')||lower.includes('4:1')||lower.includes('5:1'))return result(operation,error,'validation','Choose a valid Resin : Hardener ratio.','Select 5:1 or 4:1, then try again.');
 if(code==='42501'||code==='403'||lower.includes('permission')||lower.includes('access denied')||lower==='denied')return result(operation,error,'permission',operation==='formal-issue'?"You don't have permission to issue this Sample.":"You don't have permission to modify this Sample.",'Ask an administrator to confirm your TenOps access.');
 if(code==='23505'||code==='409'||lower.includes('changed after you opened')||lower.includes('stale')||lower.includes('conflict'))return result(operation,error,'conflict','This Sample changed after you opened it.','Reload the latest Draft before saving your changes.');
 if(code==='P0002'||code==='404'||lower.includes('not found'))return result(operation,error,'not-found','The requested Sample or version could not be found.','Reload the Sample library and try again.');
 if(code==='55000'||lower.includes('immutable')||lower.includes('issued sample deletion'))return result(operation,error,'immutable','That action is not allowed for this Sample lifecycle state.','Reload the Sample and use an available Draft, Version, or Issued action.');
 if(operation==='catalog')return result(operation,error,'catalog-invalid','TenOps could not use that Catalog material.','Keep the current manual value or search for another active Catalog item.',true);
 if(error instanceof TypeError||code==='0'||lower.includes('fetch failed')||lower.includes('network')||lower.includes('timeout')||lower.includes('connection'))return result(operation,error,'network','TenOps could not complete the operation because the connection was interrupted.','Check your connection and try again.',true);
 if(operation==='working-pdf'||operation==='issued-pdf'||lower.includes('pdf'))return result(operation,error,'pdf-generation','TenOps could not render the Sample PDF.','Try generating it again. If this continues, contact an administrator.',true);
 if(code==='22023'||lower.includes('invalid'))return result(operation,error,'validation','Some Sample information is not valid.','Review the highlighted formulation and Sample fields, then try again.');
 return result(operation,error,'unknown','TenOps could not complete this operation.','Try again. If this continues, contact an administrator.',true);
}

export function formatSampleError(error:SampleActionError){return `${error.title} — ${error.message} ${error.guidance} ${error.safeState}${error.retrySafe?' Retrying is safe.':''}`;}
export function logSampleError(error:SampleActionError){console.error('[Sample operation failed]',error.diagnostic);}

export function validateSampleForOutput(sample:SampleRecord,operation:'working-pdf'|'formal-issue'='working-pdf'):SampleActionError|null{
 const calculated=calculateSampleFormulation(sample.formulation,sample.blendRows);const participating=sample.blendRows.filter(row=>row.componentRole==='aggregate');
 if(operation==='formal-issue'&&!sample.preparedBy.trim())return result(operation,{code:'SAMPLE_PREPARED_BY_REQUIRED'},'validation','Prepared By is required for formal issuance.','Select or confirm Prepared By, then try again.');
 if(!['4:1','5:1'].includes(`${sample.formulation.resinParts}:${sample.formulation.hardenerParts}`))return result(operation,{code:'SAMPLE_INVALID_RATIO'},'validation','Choose a valid Resin : Hardener ratio.','Select 5:1 or 4:1, then try again.');
 if(participating.length&&calculated.targetWeight==='')return result(operation,{code:'SAMPLE_TARGET_MISSING'},'calculation-incomplete',sample.formulation.basis==='total_weight'?'Enter a Total Weight before calculating percentage-based quantities.':'Complete Production Pour Width and Length, Material Density, and Thickness before calculating percentage-based quantities.','Complete the Weight / SF formulation inputs, then try again.');
 if(participating.length&&!calculated.percentageReconciles)return result(operation,{code:'SAMPLE_PERCENTAGE_TOTAL'},'calculation-incomplete',`Participating formulation rows total ${calculated.percentageTotal||'0'}%. Adjust them to 100% before continuing.`,'Update only rows using “% of target weight.”');
 const hardenerIndex=sample.blendRows.findIndex(row=>row.componentRole==='hardener'&&row.quantityProvenance==='calculated');
 if(hardenerIndex>=0&&!calculated.rows[hardenerIndex]?.calculatedQuantity)return result(operation,{code:'SAMPLE_RESIN_BASIS_MISSING'},'calculation-incomplete','A Hardener quantity cannot be calculated until a Resin quantity is available.','Add or calculate a Resin quantity, or mark Hardener as manual.');
 return null;
}
