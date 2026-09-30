import type { SampleFormulationState, FormulationRowInput } from '../../../src/modules/samples/formulation';
export function validBatchTarget(value: string | null | undefined): number | null;
export function deriveBatchReference(state: SampleFormulationState): null | {chipTargetLb:number;chipDensityLbCft:number;referenceThicknessIn:number;referenceThicknessFt:number;volumeCft:number;coverageSf:number;chipRateLbSf:number};
export function formatBatchQuantity(value:number|null,unit:string):string;
export function projectSampleBatch(state:SampleFormulationState,rows:FormulationRowInput[]):{target:number|null;totalPercent:number;subtotalLb:number|null;rows:{quantity:number|null;unit:'lb'|'gal'|'';note:string}[];issues:string[];complete:boolean;fraction:number|null};
