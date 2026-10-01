// @ts-nocheck -- Deno-compatible renderer, exercised through local PDF gates.
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {buildProductionBatchModel} from './sample-production-batch.mjs';
import {normalizePdfText} from './pdf-text.mjs';
import {wrapMeasuredPdfText} from './pdf-layout.mjs';
export async function renderProductionBatch(snapshot,source) {
 const model=buildProductionBatchModel(snapshot,source);
 const pdf=await PDFDocument.create();pdf.setTitle(`Production Batch Blend Sheet - ${model.identity}`);pdf.setAuthor('Tenarten Terrazzo');pdf.setProducer(`TenOps ${model.version}`);
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.06,.13,.22),muted=rgb(.3,.35,.4),pale=rgb(.94,.96,.98),line=rgb(.7,.74,.78),white=rgb(1,1,1);
 const wrap=(v,w,size=10,font=regular)=>wrapMeasuredPdfText(normalizePdfText(v),w,size,(s,n)=>font.widthOfTextAtSize(s,n));
 let page,y;const pages=[];
 const text=(v,x,yy,size=10,font=regular,color=ink)=>page.drawText(normalizePdfText(v),{x,y:yy,size,font,color});
 function newPage(){page=pdf.addPage([612,792]);pages.push(page);page.drawRectangle({x:36,y:725,width:540,height:38,color:ink});text('PRODUCTION BATCH BLEND SHEET',46,740,16,bold,white);text(model.status,36,705,11,bold);text('ONE BATCH',494,705,10,bold);y=680;}
 function ensure(height){if(y-height<66)newPage();}
 function block(label,value){if(!value)return;ensure(36);text(label.toUpperCase(),36,y,9,bold,muted);y-=17;for(const part of wrap(value,540,11)){ensure(14);text(part,36,y,11);y-=14;}y-=6;}
 newPage();block('Formulation',model.identity);block('Captured profile',`${model.profile} · Revision ${model.profileRevision} · Resin:Hardener ${model.binderRatio}`);
 block('Source',model.source==='issued'?`Issue ${model.issueNumber} · ${model.sourceDate}${model.approvedDate?' · Approval recorded '+model.approvedDate:''}`:`Current saved draft · ${model.sourceDate}`);
 if(model.project||model.job)block('Project / Job',[model.project,model.job?'Job '+model.job:''].filter(Boolean).join(' · '));
 let basis=`${model.batchTarget} lb chips = 100%`;
 if(model.resolvedBatch.modified)basis+=`\nModified Filler: ${model.resolvedBatch.filler} lb (profile ${model.resolvedBatch.baselineFiller} lb). Profile Chip Mix: ${model.resolvedBatch.baselineChip} lb.`;
 if(model.reference){const r=model.reference;const n=v=>Number(v.toFixed(6)).toLocaleString('en-US',{maximumFractionDigits:6});basis+=`\n${n(r.coverageSf)} SF @ ${r.referenceThicknessIn===.375?'3/8':n(r.referenceThicknessIn)} in · ${n(r.chipRateLbSf)} lb chips/SF`;}
 if(model.reference && model.effectiveChipDensityLbCft!==model.reference.chipDensityLbCft)basis+=`\nProfile reference yield above; formulation chip density ${model.effectiveChipDensityLbCft} lb/CFT differs from profile ${model.reference.chipDensityLbCft} lb/CFT.`;
 block('Batch basis',basis);
 const widths=[176,46,44,110,164],labels=['MATERIAL / VENDOR','SIZE','BLEND','BATCH QTY','PACKAGE EQ.'];
 function tableHeader(group){ensure(67);text(group,36,y,12,bold);y-=29;let x=36;for(let i=0;i<widths.length;i++){page.drawRectangle({x,y:y-5,width:widths[i],height:23,color:pale});text(labels[i],x+5,y+3,8,bold);x+=widths[i];}y-=5;}
 let currentGroup='';
 for(const row of model.rows){
  const group=row.role==='aggregate'?'CHIP BLEND':'OTHER COMPONENTS';if(group!==currentGroup){y-=20;tableHeader(group);currentGroup=group;}
  const roleName={filler:'Filler',resin:'Resin / Part A',hardener:'Hardener / Part B',other:'Other'}[row.role];
  const material=[roleName,roleName===row.color?null:row.color,row.vendor].filter(Boolean).join('\n');
  const fields=[material,row.size,row.role==='aggregate'?`${row.percentage}%`:'',row.quantityLabel.replace('≈','~')+(row.exactLiquid?'\n('+row.exactLiquid+')':''),['aggregate','filler'].includes(row.role)?(row.package?.label||'Unavailable'):''];
  const cells=fields.map((v,i)=>wrap(v,widths[i]-10,10,i===3?bold:regular));let offset=0;const length=Math.max(...cells.map(c=>c.length),1);
  if(y-(length*13+12)<66 && length*13+12<540){newPage();tableHeader(group+' - CONTINUED');}
  while(offset<length){
   if(y-34<66){newPage();tableHeader(group+' - CONTINUED');}
   const count=Math.min(length-offset,Math.floor((y-66-12)/13));const height=count*13+12;let x=36;
   for(let i=0;i<widths.length;i++){page.drawRectangle({x,y:y-height,width:widths[i],height,borderWidth:.5,borderColor:line});cells[i].slice(offset,offset+count).forEach((part,j)=>text(part,x+5,y-16-j*13,10,i===3?bold:regular));x+=widths[i];}
   y-=height;offset+=count;
  }
 }
 y-=24;
 const notes=[snapshot.notes,snapshot.more_notes??snapshot.moreNotes].filter(Boolean).join('\n');block('Formulation notes',notes);
 for(let i=0;i<pages.length;i++){page=pages[i];text('Package equivalents are informational. Batch quantities govern; no inventory consumption.',36,54,7,regular,muted);text(model.status,36,40,8,bold);text(`Page ${i+1} of ${pages.length}`,506,40,8);text(`${model.version} · Source Sample ${model.sampleId}`,36,26,6,regular,muted);}
 return new Uint8Array(await pdf.save());
}
