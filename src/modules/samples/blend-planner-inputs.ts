export type BlendPlannerInputs = {batchCount:string; plannedQuantity:string; blendSize:string};
/** Planned pounds remain the persisted authority; ADJ is its editable projection. */
export function editBlendPlanning(inputs:BlendPlannerInputs, field:'batchCount'|'adjustment'|'blendSize', value:string, chipsPerBatch:number):BlendPlannerInputs {
  if(field==='blendSize')return {...inputs,blendSize:value};
  const adjustment=Number(inputs.plannedQuantity)-Number(inputs.batchCount)*chipsPerBatch;
  return field==='adjustment'
    ? {...inputs,plannedQuantity:value.trim()===''?'':String(Number(inputs.batchCount)*chipsPerBatch+Number(value))}
    : {...inputs,batchCount:value,plannedQuantity:value.trim()===''?'':String(Number(value)*chipsPerBatch+adjustment)};
}
