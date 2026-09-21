import type {SampleRecord} from './types';
import {normalizeSupportedSampleRatio} from './formulation';

const clean=(value:string)=>value.trim();
const plural=(count:number,word:string)=>`${count} ${word}${count===1?'':'s'}`;

export function sampleLibraryTitle(sample:SampleRecord){return clean(sample.sampleName)||clean(sample.projectName)||clean(sample.colorPlateNumber)||'Untitled Sample';}

export function sampleLibraryContext(sample:SampleRecord){
 const title=sampleLibraryTitle(sample);const values=[clean(sample.customerName),clean(sample.projectName),clean(sample.colorPlateNumber)].filter(value=>value&&value!==title);
 return [...new Set(values)].join(' · ');
}

export function sampleFormulationPreview(sample:SampleRecord){
 const materials=sample.blendRows.map(row=>[clean(row.color),clean(row.size)].filter(Boolean).join(' ')).filter(Boolean).slice(0,2);
 if(!materials.length)return'No materials added';
 const resin=clean(sample.resinColorNumber)||clean(sample.resinSupplier);if(resin&&!materials.some(value=>value.toLowerCase().includes(resin.toLowerCase())))materials.push(`${resin} resin`);
 const ratio=normalizeSupportedSampleRatio(sample.formulation.resinParts,sample.formulation.hardenerParts);if(ratio)materials.push(`${ratio} resin`);
 return materials.slice(0,3).join(' · ');
}

export function sampleLibraryMetadata(sample:SampleRecord,locale?:string){
 const updated=sample.updatedAt?new Date(sample.updatedAt).toLocaleDateString(locale,{month:'short',day:'numeric'}):'';
 const author=clean(sample.preparedBy)||clean(sample.creatorName);const state=sample.issuedDocuments.length?'Issued':'Draft';
 return [updated,author,state,sample.workingVersions.length?`v${sample.workingVersions.length}`:''].filter(Boolean).join(' · ');
}

export function sampleLibraryStatus(sample:SampleRecord){return`${sample.issuedDocuments.length?'Issued':'Draft'} · ${plural(sample.workingVersions.length,'version')}`;}
