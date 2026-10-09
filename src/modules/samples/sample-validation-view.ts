import {calculateSampleFormulation} from './formulation';
import {validateSampleForOutput} from './sample-errors';
import {geometryInputErrors} from './pour-planning';
import {resinConflict} from './resin-identity';
import type {SampleRecord} from './types';
export type SampleAttention = {label:string; section:string; selector?:string; message:string};
// Presentation of the calculator's existing reconciliation flag, not a second tolerance.
export function chipTotalMessage(total:string,reconciles:boolean) {
 const n=Number(total||0), difference=Number(Math.abs(n-100).toFixed(6));
 if(reconciles)return '';
 return n>100?`Blend exceeds 100% by ${difference}%. Reduce aggregate percentages.`:n<100?`Blend is ${difference}% short of 100%.`:'Complete the aggregate percentages to reconcile the blend.';
}
export function sampleAttention(sample:SampleRecord):SampleAttention[] {
 const result:SampleAttention[]=[], q=calculateSampleFormulation(sample.formulation,sample.blendRows);
 const geometry=geometryInputErrors(sample.formulation);
 if(!sample.id&&!sample.formulation.profile)result.push({label:'Resin System',section:'formulation-setup',selector:'select',message:'Select a Resin System before saving or generating.'});
 if(!q.percentageReconciles&&sample.blendRows.some(r=>r.componentRole==='aggregate'))result.push({label:`Chip Blend (${q.percentageTotal||0}%)`,section:'batch-formulation',selector:'.blend-percent input',message:chipTotalMessage(q.percentageTotal,q.percentageReconciles)});
 if(geometry.length)result.push({label:`Sample Plate (${geometry[0].label})`,section:'sample-plate',selector:`[aria-label="${geometry[0].label}"]`,message:geometry[0].message});
 if(resinConflict(sample))result.push({label:'Resin identity',section:'formulation-materials',message:'Resolve Resin Color / # and Resin row differences before saving.'});
 const unnamed=sample.blendRows.find(r=>r.componentRole==='aggregate'&&!r.color.trim());
 if(unnamed)result.push({label:'Aggregate identity (Production)',section:'batch-formulation',selector:`[data-sample-material-row="${unnamed.id}"] input[role="combobox"]`,message:'Identify every aggregate material before Production Blend generation.'});
 const output=validateSampleForOutput(sample,'formal-issue');
 if(output){
  const code=output.diagnostic.code;
  const section=code==='SAMPLE_PREPARED_BY_REQUIRED'?'sample-context':code==='SAMPLE_INVALID_RATIO'?'formulation-setup':code==='SAMPLE_PERCENTAGE_TOTAL'?'batch-formulation':'sample-plate';
  if(!result.some(r=>r.section===section))result.push({label:section==='sample-context'?'Prepared By':section==='formulation-setup'?'Resin System':'Sample preparation',section,selector:section==='sample-context'?'input[aria-label="Prepared By"]':undefined,message:output.message});
 }
 return result;
}
export function focusSampleAttention(item:SampleAttention) {
 const section=document.getElementById(item.section);if(!section)return;
 const control=item.selector?section.querySelector<HTMLElement>(item.selector):null;
 const target=control??section;target.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true});
}
