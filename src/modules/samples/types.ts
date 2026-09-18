import {standardFormulationState,type SampleFormulationState} from './formulation';

export type SampleBlendRow={id:string;percentage:string;color:string;size:string;materialType:string;quantity:string;unit:string;vendor:string;catalogSource:'standard'|'specialty'|null;catalogItemId:string|null;catalogSnapshot:Record<string,unknown>;displayOrder:number;componentRole:'aggregate'|'filler'|'resin'|'hardener'|'other';calculationBasis:'target_total'|null;quantityProvenance:'calculated'|'manual';calculatedQuantity:string};
export type SampleIssuedDocument={id:string;sampleId:string;issueNumber:number;issuedAt:string;issuedByUserId:string;storagePath:string;snapshotHash:string;generationStatus:'pending'|'generating'|'generated'|'failed';generatedAt:string|null;lastError:string|null};
export type SampleWorkingVersion={id:string;sampleId:string;versionNumber:number;versionNote:string;savedAt:string;savedByUserId:string;savedByName:string};
export type SampleRecord={id:string;sampleName:string;bidId:string;jobId:string;requestedBy:string;requestedDate:string;projectName:string;preparedBy:string;customerName:string;colorPlateNumber:string;finishRequested:string;sampleSize:string;sampleQuantity:string;notes:string;filler:string;sealer:string;resinSupplier:string;resinColorNumber:string;moreNotes:string;approvedDate:string;createdByUserId:string;creatorName:string;createdAt:string;updatedAt:string;jobNumber:string;formulation:SampleFormulationState;blendRows:SampleBlendRow[];workingVersions:SampleWorkingVersion[];issuedDocuments:SampleIssuedDocument[]};

const sampleRoleOrder:Record<SampleBlendRow['componentRole'],number>={aggregate:0,filler:1,other:2,resin:3,hardener:4};
export function sampleRowsForDisplay(rows:SampleBlendRow[]){return rows.map((row,sourceIndex)=>({row,sourceIndex})).sort((left,right)=>sampleRoleOrder[left.row.componentRole]-sampleRoleOrder[right.row.componentRole]||left.sourceIndex-right.sourceIndex);}

export function blankSampleBlendRow(order:number):SampleBlendRow{return{id:crypto.randomUUID(),percentage:'',color:'',size:'',materialType:'',quantity:'',unit:'oz',vendor:'',catalogSource:null,catalogItemId:null,catalogSnapshot:{},displayOrder:order,componentRole:'aggregate',calculationBasis:'target_total',quantityProvenance:'calculated',calculatedQuantity:''};}
function standardFormulaRows():SampleBlendRow[]{return[
  blankSampleBlendRow(0),
  {...blankSampleBlendRow(1),color:'Filler',componentRole:'filler',calculationBasis:null,quantityProvenance:'calculated',unit:'oz'},
  {...blankSampleBlendRow(2),color:'Resin',componentRole:'resin',calculationBasis:null,quantityProvenance:'calculated',unit:'fl oz'},
  {...blankSampleBlendRow(3),color:'Hardener',componentRole:'hardener',calculationBasis:null,quantityProvenance:'calculated',unit:'fl oz'},
];}
export function newLocalSample(input:{preparedBy:string;bidId?:string;projectName?:string;customerName?:string;formulation?:SampleFormulationState}):SampleRecord{const now=new Date().toISOString();return{id:'',sampleName:'',bidId:input.bidId??'',jobId:'',requestedBy:'',requestedDate:now.slice(0,10),projectName:input.projectName??'',preparedBy:input.preparedBy,customerName:input.customerName??'',colorPlateNumber:'',finishRequested:'',sampleSize:'',sampleQuantity:'',notes:'',filler:'',sealer:'',resinSupplier:'',resinColorNumber:'',moreNotes:'',approvedDate:'',createdByUserId:'',creatorName:input.preparedBy,createdAt:'',updatedAt:'',jobNumber:'',formulation:input.formulation??standardFormulationState(),blendRows:standardFormulaRows(),workingVersions:[],issuedDocuments:[]};}
