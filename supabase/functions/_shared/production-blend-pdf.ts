// @ts-nocheck -- shared Deno/Node renderer; validated with rendered PDF fixtures.
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {normalizePdfText} from './pdf-text.mjs';
import {wrapMeasuredPdfText} from './pdf-layout.mjs';
import {productionBlendSheet} from './production-blend-sheet.mjs';
import {blendNumber as n} from './production-blend.mjs';
export async function renderProductionBlend(plan){
 const m=plan.model,sheet=productionBlendSheet(plan);
 const pdf=await PDFDocument.create();pdf.setTitle(`Material Quantity & Blend Sheet - ${m.identity}`);pdf.setAuthor('Tenarten Terrazzo');
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.07,.13,.23),muted=rgb(.35,.4,.47),pale=rgb(.94,.96,.98),white=rgb(1,1,1),border=rgb(.72,.76,.81);
 const left=28,width=736,bottom=46;let page,y;const pages=[];
 const printable=v=>String(v??'').split('—').map(normalizePdfText).join(' — ').trim();
 const text=(v,x,yy,size=9,font=regular,color=ink)=>page.drawText(printable(v),{x,y:yy,size,font,color});
 const wrap=(v,w,size=9,font=regular)=>wrapMeasuredPdfText(printable(v),w,size,(s,n)=>font.widthOfTextAtSize(s,n));
 function newPage(){page=pdf.addPage([792,612]);pages.push(page);page.drawRectangle({x:left,y:560,width,height:28,color:ink});text('MATERIAL QUANTITY & BLEND SHEET',left+10,569,16,bold,white);text(plan.status==='issued'?'ISSUED':'WORKING — NOT ISSUED',left,547,8,bold,muted);y=530;if(pages.length>1){text(`PLATE # ${sheet.plate} · JOB # ${sheet.job}`,left,y,9,bold);y-=19;}}
 const ensure=h=>{if(y-h<bottom)newPage();};
 function line(value){for(const part of wrap(value,width)){ensure(14);text(part,left,y);y-=14;}}
 newPage();
 line(`DATE: ${sheet.date} · JOB #: ${sheet.job} · WO #: ${sheet.workOrder}`);
 line(`JOB NAME: ${sheet.project} · PLATE #: ${sheet.plate}`);
 line(`RESIN "A": ${sheet.profile} · ${m.binder.resinIdentity||'—'} — ${m.binder.resin?`${n(m.binder.resin.total)} US gal`:'Production quantity unavailable'}`);
 line(`RESIN "B": ${sheet.profile} · ${m.binder.hardenerIdentity||'—'} — ${m.binder.hardener?`${n(m.binder.hardener.total)} US gal`:'Production quantity unavailable'}`);
 for(const filler of m.filler)line(`FILLER: ${filler.material||'—'} — ${filler.quantity==null?'Production quantity unavailable':`${n(filler.quantity)} lb${filler.package?` · ${n(filler.package.equivalent)} × ${n(filler.package.weightLb)} lb / ${filler.package.container}`:''}`}`);
 for(const other of sheet.other)line(`${other.label}: ${other.name} — Production quantity unavailable`);
 y-=12;
 const widths=[64,50,195,48,30,54,70,137,43,45];
 function header(){ensure(65);text('CHIP BLEND',left,y,11,bold);y-=15;let x=left;['BAGS / BLEND','SKU','CHIP COLOR','% OF BLEND','SIZE','TYPE','VENDOR','BAGS REQUIRED','IN STOCK','NEED TO ORDER'].forEach((label,i)=>{page.drawRectangle({x,y:y-31,width:widths[i],height:31,color:pale});wrap(label,widths[i]-8,7.5,bold).forEach((part,j)=>text(part,x+4,y-10-j*9,7.5,bold,i>7?muted:ink));x+=widths[i];});y-=31;}
 header();
 for(const row of sheet.rows){
  const cells=[row.perBlend,row.sku,row.material,`${n(row.percentage)}%`,row.size,row.type,row.vendor,row.required,'—','—'].map((value,i)=>wrap(value,widths[i]-8,i===0||i===7?10:9,i===0||i===7?bold:regular));
  const length=Math.max(...cells.map(c=>c.length),1);let offset=0;
  if(y-(length*12+10)<bottom&&length*12+10<350){newPage();header();}
  while(offset<length){if(y-24<bottom){newPage();header();}const count=Math.min(length-offset,Math.max(1,Math.floor((y-bottom-10)/12))),height=count*12+10;let x=left;
   for(let i=0;i<widths.length;i++){page.drawRectangle({x,y:y-height,width:widths[i],height,borderWidth:.4,borderColor:border});cells[i].slice(offset,offset+count).forEach((part,j)=>text(part,x+4,y-15-j*12,i===0||i===7?10:9,i===0||i===7?bold:regular,i>7?muted:ink));x+=widths[i];}y-=height;offset+=count;
  }
 }
 if(y-25<bottom){newPage();header();}
 let x=left;const totals=[sheet.totalPerBlend,'','TOTAL',`${sheet.totalPercentage}%`,'','','',sheet.totalRequired,'—','—'];
 totals.forEach((value,i)=>{page.drawRectangle({x,y:y-24,width:widths[i],height:24,color:pale});text(value,x+4,y-16,9,bold,i>7?muted:ink);x+=widths[i];});y-=40;
 if(sheet.full){ensure(14);text(`${n(m.blendCount)} CHIP BLENDS`,left,y,11,bold);}
 for(let i=0;i<pages.length;i++){page=pages[i];text(`PLATE # ${sheet.plate}`,left,22,8,regular,muted);text(`Page ${i+1} of ${pages.length}`,width-35,22,8,regular,muted);}
 return new Uint8Array(await pdf.save());
}
