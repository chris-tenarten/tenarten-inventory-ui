// @ts-nocheck -- shared Deno/local PDF renderer, covered by focused layout gates.
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {buildSamplePdfModel} from './sample-work-order-pdf-model.mjs';
import {wrapMeasuredPdfText} from './pdf-layout.mjs';
import {normalizePdfText} from './pdf-text.mjs';
export const COMPACT_SAMPLE_VERSION='sample-work-order-pdf-v9-compact';
export async function renderCompactSample(snapshot){
 const model=buildSamplePdfModel(snapshot,COMPACT_SAMPLE_VERSION),pdf=await PDFDocument.create();
 pdf.setTitle(`Sample Work Order ${model.colorPlateNumber||snapshot.sampleName||snapshot.sample_name||''}`);pdf.setAuthor('Tenarten Terrazzo');pdf.setProducer(`TenOps ${COMPACT_SAMPLE_VERSION}`);
 const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const navy=rgb(.05,.12,.22),blue=rgb(.08,.28,.48),pale=rgb(.94,.96,.98),gray=rgb(.35,.39,.44),white=rgb(1,1,1);
 const wrap=(v,w,size=9,f=font)=>wrapMeasuredPdfText(normalizePdfText(v),w,size,(t,s)=>f.widthOfTextAtSize(t,s));
 const status=model.issueNumber?`ISSUED FORM - ISSUE ${model.issueNumber}`:model.renderContext==='working'?'WORKING SAMPLE - NOT ISSUED':'DRAFT PREVIEW';
 const state=snapshot.formulation??snapshot.formulation_state??{};let page,y;const pages=[];
 const text=(t,x,yy,size=9,f=font,color=navy)=>page.drawText(normalizePdfText(t),{x,y:yy,size,font:f,color});
 function start(){page=pdf.addPage([612,792]);pages.push(page);page.drawRectangle({x:36,y:734,width:540,height:30,color:navy});text('TENARTEN TERRAZZO',44,745,15,bold,white);text('SAMPLE WORK ORDER',417,746,10,bold,white);text(status,36,720,9,bold,blue);y=703;}
 function lines(value,width=540,size=9){for(const line of wrap(value,width,size)){if(y<54){start();}text(line,36,y,size);y-=12;}}
 function field(label,value){if(value){lines(`${label}: ${value}`);}}
 start();
 field('Sample / Color Plate',[model.colorPlateNumber,snapshot.sampleName??snapshot.sample_name].filter(Boolean).join(' · ')||'Unnumbered Sample');
 field('Resin System',state.profile?.name||model.resinSupplier||'Captured formulation');
 field('Project / Customer',[model.projectName,model.customerName].filter(Boolean).join(' · '));
 field('Requested',[model.requestedBy,model.requestedDate].filter(Boolean).join(' · '));
 field('Prepared / Approved',[model.preparedBy,model.approvedDate].filter(Boolean).join(' · '));
 field('Working Pour',model.workingPour);field('Finished Plates',model.finishedOutput);
 field('Finish / Sealer',[model.finishRequested,model.sealer].filter(Boolean).join(' · '));
 field('Resin Color / #',model.resinColorNumber);
 // Preserve free-text metadata without mistaking it for pour geometry.
 field('Sample metadata',[model.sampleSize,model.sampleQuantity?`Qty ${model.sampleQuantity}`:''].filter(Boolean).join(' · '));
 field('Batch basis',model.batchBasis);y-=8;
 const widths=[28,162,35,65,62,42,146],labels=['%','COLOR / MATERIAL','SIZE','TYPE','SHOP QTY','UNIT','VENDOR'];
 function tableHeader(){if(y<110)start();page.drawRectangle({x:36,y:y-21,width:540,height:21,color:blue});text('SHOP PREPARATION QUANTITIES',43,y-14,10,bold,white);y-=43;let x=36;labels.forEach((label,i)=>{page.drawRectangle({x,y,width:widths[i],height:22,color:pale,borderColor:navy,borderWidth:.5});text(label,x+4,y+8,7.5,bold);x+=widths[i];});}
 tableHeader();
 for(const row of model.rows){
  const fields=[row.percentage,row.color,row.size,row.materialType,row.quantity,row.unit,row.vendor];
  const cells=fields.map((v,i)=>wrap(v,widths[i]-8,i===4?9:8.5,i===4?bold:font));const length=Math.max(1,...cells.map(c=>c.length));let offset=0;
  if(y-(length*11+8)<54&&length*11+8<550){start();tableHeader();}
  while(offset<length){if(y<80){start();tableHeader();}const count=Math.min(length-offset,Math.floor((y-54-8)/11));const height=count*11+8;let x=36;
   cells.forEach((cell,i)=>{page.drawRectangle({x,y:y-height,width:widths[i],height,borderColor:navy,borderWidth:.5});cell.slice(offset,offset+count).forEach((s,j)=>text(s,x+4,y-12-j*11,i===4?9:8.5,i===4?bold:font));x+=widths[i];});y-=height;offset+=count;
  }
 }
 y-=16;field('Notes',[model.notes,model.moreNotes].filter(Boolean).join(' · '));
 for(let i=0;i<pages.length;i++){page=pages[i];text(status,36,27,7,bold,gray);text(`Page ${i+1} of ${pages.length}`,518,27,7,font,gray);text(COMPACT_SAMPLE_VERSION,36,16,6,font,gray);}
 return new Uint8Array(await pdf.save());
}
