import {blankFormulationState} from '@/modules/samples/formulation';
import {blankSampleBlendRow,newLocalSample,type SampleRecord} from '@/modules/samples/types';
export type Point={x:number;y:number;text:string};
export type HistoricalExtraction={sample:SampleRecord;warnings:string[];locator:string;parserVersion:'tenarten-historical-v1'};
const norm=(s:unknown)=>String(s??'').trim();
export function extractWorkbookForm(rows:unknown[][],locator:string):HistoricalExtraction{
 const sample=newLocalSample({preparedBy:'',formulation:blankFormulationState()});sample.blendRows=[];
 const warnings=['Workbook formulas use saved cached values; no recalculation or external links are executed.','Batch/yield authority is not inferred from shop quantities.'];
 const values=rows.map(r=>r.map(norm));
 const field=(label:RegExp)=>{for(const row of values){const i=row.findIndex(v=>label.test(v));if(i>=0){const inline=row[i].split(':').slice(1).join(':').trim();const next=row.slice(i+1).find(v=>v);return inline||(next&&!/:$/.test(next)?next:'')||'';}}return '';};
 sample.colorPlateNumber=field(/COLOR PLATE\s*#/i);sample.projectName=field(/PROJECT NAME/i);sample.customerName=field(/CUSTOMER NAME/i);sample.finishRequested=field(/FINISH REQUESTED/i);sample.resinSupplier=field(/RESIN SUPPLIER/i);sample.resinColorNumber=field(/RESIN COLOR/i);sample.filler=field(/^FILLER\s*:/i);sample.sealer=field(/^SEALER\s*:/i);sample.sampleSize=field(/SAMPLE SIZE/i);sample.sampleQuantity=field(/SAMPLE QUANTITY/i);
 const header=values.findIndex(r=>r.includes('%')&&r.some(c=>/^COLOR$/i.test(c))&&r.some(c=>/^UNIT$/i.test(c)));
 if(header<0)warnings.push('Recognized chip table not found. Transcribe from the original.');
 else{
  const h=values[header],col=(name:string)=>h.findIndex(c=>c.toUpperCase()===name);
  for(const row of values.slice(header+1,header+16)){
   const color=row[col('COLOR')];if(!color)continue;
   const percentage=row[col('%')];const raw=rows[values.indexOf(row)]?.[col('%')];if(typeof raw==='number'&&raw>0&&raw<=1)warnings.push('Fractional Excel percentage converted to percent; confirm against displayed workbook formatting.');
   sample.blendRows.push({...blankSampleBlendRow(sample.blendRows.length),color,percentage:percentage.endsWith('%')?percentage.slice(0,-1):typeof raw==='number'&&raw>0&&raw<=1?String(raw*100):percentage,size:row[col('SIZE')]||'',materialType:row[col('TYPE')]||'',quantity:row[col('QTY')]||'',unit:row[col('UNIT')]||'',vendor:row[col('VENDOR')]||'',quantityProvenance:'manual',calculationBasis:null});
  }
 }
 if(!sample.blendRows.length)warnings.push('No formulation rows extracted.');
 if(sample.blendRows.some(r=>r.percentage.trim()===''||!Number.isFinite(Number(r.percentage))))warnings.push('Missing or unsupported aggregate percentages require review.');
 if(sample.blendRows.length&&Math.abs(sample.blendRows.reduce((s,r)=>s+(Number(r.percentage)||0),0)-100)>.0005)warnings.push('Extracted aggregate percentages do not total 100%.');
 if(!/^T\d{2}-\d{3,}-?[A-Z]$/i.test(sample.colorPlateNumber))warnings.push('Full Plate number is missing or ambiguous.');
 return {sample,warnings,locator,parserVersion:'tenarten-historical-v1'};
}
/** Format-specific coordinates are normalized to the document's own header columns. */
export function extractPdfForm(points:Point[],locator:string):HistoricalExtraction{
 const sample=newLocalSample({preparedBy:'',formulation:blankFormulationState()});sample.blendRows=[];
 const warnings=['PDF extraction is text-only; scanned/handwritten forms require transcription.','Shop quantities and printed bag counts are not canonical Batch/package authority.'];
 const text=points.map(p=>p.text).join(' '),plates=[...new Set(text.match(/T\d{2}-\d{3,}-?[A-Z]/gi)??[])];
 sample.colorPlateNumber=plates.length===1?plates[0]:'';
 if(plates.length!==1)warnings.push('Expected one unambiguous Plate number on the selected page.');
 const getRight=(label:RegExp,right=Infinity)=>{const p=points.find(p=>label.test(p.text));return p?points.filter(v=>Math.abs(v.y-p.y)<=4&&v.x>p.x+25&&v.x<right&&v.text.trim()&&!label.test(v.text)).sort((a,b)=>a.x-b.x).map(v=>v.text).join(' ').trim():'';};
 sample.projectName=getRight(/^(Project Name:|JOB\. NAME)$/i,350);sample.customerName=getRight(/^Cust[io]+mer$/i,220);sample.finishRequested=getRight(/^FINISH:/i,225);sample.resinColorNumber=getRight(/^MATRIX COLOR:/i,295);sample.filler=getRight(/^FILLER:?$/i);sample.sealer=getRight(/^SEALER:/i);
 const production=text.includes('BLEND SHEET')&&text.includes('% of Blend');
 const percentHeader=points.find(p=>production?p.text.includes('% of Blend'):p.text.trim()==='%');
 const colorHeader=points.find(p=>production?p.text==='CHIP COLOR':p.text==='COLOR');
 const sizeHeader=points.find(p=>p.text==='SIZE'&&(!percentHeader||Math.abs(p.y-percentHeader.y)<15));
 const typeHeader=points.find(p=>p.text==='TYPE'&&(!percentHeader||Math.abs(p.y-percentHeader.y)<15));
 const vendorHeader=points.find(p=>p.text==='VENDOR'&&(!percentHeader||Math.abs(p.y-percentHeader.y)<15));
 if(percentHeader&&colorHeader&&sizeHeader&&typeHeader&&vendorHeader){
  const xPercent=percentHeader.x, xSize=sizeHeader.x,xType=typeHeader.x,xVendor=vendorHeader.x;
  const percentages=points.filter(p=>/^\d+(?:\.\d+)?%$/.test(p.text.trim())&&p.y<percentHeader.y-5&&Math.abs(p.x-xPercent)<28).sort((a,b)=>b.y-a.y);
  for(const p of percentages){
   const nearby=points.filter(v=>Math.abs(v.y-p.y)<=4&&v.text.trim()).sort((a,b)=>a.x-b.x);
   const cell=(left:number,right:number)=>nearby.filter(v=>v.x>=left&&v.x<right).map(v=>v.text.trim()).filter(Boolean).join(' ');
   const color=cell(colorHeader.x-55,xPercent-12);if(/^TOTAL$/i.test(color)||(!color&&p.text.trim()==='100%'))break;if(!color)continue;
   sample.blendRows.push({...blankSampleBlendRow(sample.blendRows.length),color,percentage:p.text.replace('%',''),size:cell(xSize-8,xType-8),materialType:cell(xType-8,xVendor-12),vendor:cell(xVendor-12,xVendor+30),quantityProvenance:'manual',calculationBasis:null,unit:'oz'});
  }
 }
 if(!production){for(const role of ['filler','resin','hardener'] as const){const label=points.find(p=>p.text.toLowerCase()===role);if(!label)continue;const quantity=points.find(p=>Math.abs(p.y-label.y)<=4&&p.x>label.x+40&&p.x<label.x+135&&/^\d+(?:\.\d+)?$/.test(p.text));sample.blendRows.push({...blankSampleBlendRow(sample.blendRows.length),componentRole:role,color:role==='filler'?sample.filler:role==='resin'?sample.resinColorNumber:'Hardener',quantity:quantity?.text||'',unit:'oz',quantityProvenance:'manual',calculationBasis:null});}warnings.push('Printed liquid ounces require review of volume versus weight; no Batch conversion is inferred.');}
 else warnings.push('Printed Production totals are not per-Batch authority; review against the original before selecting a managed formulation.');
 if(!sample.blendRows.some(r=>r.componentRole==='aggregate'))warnings.push('No supported aggregate table found. Review/transcribe all rows.');
 if(/#REF!|#VALUE!|#DIV\/0!/.test(text))warnings.push('Original contains spreadsheet errors; affected calculations are unsupported.');
 sample.notes=`Historical import: ${locator}. Original retained separately. Verify all formulation values before planning.`;
 return {sample,warnings,locator,parserVersion:'tenarten-historical-v1'};
}
