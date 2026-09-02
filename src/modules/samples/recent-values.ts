import {supabase} from '@/lib/supabase';
import type {SampleRecord} from './types';

export const sampleRecentFieldKeys={
  requestedBy:'requested_by',projectName:'project_name',customerName:'customer_name',finishRequested:'finish_requested',sampleSize:'sample_size',sampleQuantity:'sample_quantity',filler:'filler',sealer:'sealer',resinSupplier:'resin_supplier',resinColorNumber:'resin_color_number',
} as const;

export type SampleRecentFieldKey=(typeof sampleRecentFieldKeys)[keyof typeof sampleRecentFieldKeys];

export async function loadMySampleRecentValues(fieldKey:SampleRecentFieldKey){
  const{data,error}=await supabase.rpc('list_my_sample_recent_values',{p_field_key:fieldKey});
  if(error)throw error;
  return ((data??[]) as Array<{value:string}>).map((row)=>row.value);
}

export async function recordMySampleRecentValues(sample:SampleRecord){
  const{error}=await supabase.rpc('record_my_sample_recent_values',{p_values:{
    requested_by:sample.requestedBy,project_name:sample.projectName,customer_name:sample.customerName,finish_requested:sample.finishRequested,sample_size:sample.sampleSize,sample_quantity:sample.sampleQuantity,filler:sample.filler,sealer:sample.sealer,resin_supplier:sample.resinSupplier,resin_color_number:sample.resinColorNumber,
  }});
  if(error)throw error;
}
