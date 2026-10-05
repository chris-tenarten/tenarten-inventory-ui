// @ts-nocheck -- shared Deno/Node renderer; validated with rendered PDF fixtures.
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {normalizePdfText} from './pdf-text.mjs';
import {wrapMeasuredPdfText} from './pdf-layout.mjs';
import {blendShopPresentation} from './production-blend-shop.mjs';
import {blendNumber as n} from './production-blend.mjs';
export async function renderProductionBlend(plan){
 const m=plan.model,status=plan.status==='issued'?'ISSUED PRODUCTION BLEND SHEET':'WORKING PRODUCTION BLEND — NOT ISSUED';
 const shop=blendShopPresentation(m,plan.status==='issued');
 const batches=`${n(m.batchCount)} ${m.batchCount===1?'Batch':'Batches'}`;
 const profile=m.profile.replace(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/g,(_,a,b)=>`${Number(a)}:${Number(b)}`).replace(/\s[-–]\s(?=\d+:)/g,' — ');
 const pdf=await PDFDocument.create();pdf.setTitle(`Production Blend Sheet - ${m.identity}`);pdf.setAuthor('Tenarten Terrazzo');
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.07,.13,.23),muted=rgb(.35,.4,.47),pale=rgb(.94,.96,.98),white=rgb(1,1,1);let page,y;const pages=[];
 const printable=v=>String(v).split('—').map(normalizePdfText).join(' — ').trim();
 const text=(v,x,yy,size=10,font=regular,color=ink)=>page.drawText(printable(v),{x,y:yy,size,font,color});
 const wrap=(v,w,size=10,font=regular)=>wrapMeasuredPdfText(printable(v),w,size,(s,n)=>font.widthOfTextAtSize(s,n));
 function newPage(){page=pdf.addPage([612,792]);pages.push(page);page.drawRectangle({x:36,y:727,width:540,height:35,color:ink});text('TENOPS  /  PRODUCTION BLEND SHEET',46,740,15,bold,white);text(status,36,710,9,bold);y=685;if(pages.length>1){for(const part of wrap(`Color Plate: ${m.identity}`,540,10)){text(part,36,y,10,bold);y-=14;}y-=8;}}
 const ensure=h=>{if(y-h<68)newPage();};
 function line(label,value){const parts=wrap(`${label}: ${value}`,540,10);for(const part of parts){ensure(16);text(part,36,y);y-=14;}y-=5;}
 newPage();line('Color Plate',m.identity);if(m.job||m.project)line('Job / Project',[m.job,m.project].filter(Boolean).join(' / '));line('Resin System',profile);
 ensure(58);page.drawRectangle({x:36,y:y-43,width:540,height:49,color:pale});
 const metrics=m.blendCount<1
  ? [['BATCH SIZE',`${n(m.batchChipLb)} lb`],['BATCH COUNT',n(m.batchCount)],['PLANNED CHIP TOTAL',`${n(m.plannedQuantity)} lb`]]
  : [['BLENDS',n(m.blendCount)],['BLEND SIZE',`${n(m.blendSize)} lb`],['BATCH COUNT',n(m.batchCount)],['PLANNED CHIP TOTAL',`${n(m.plannedQuantity)} lb`]];
 metrics.forEach(([label,value],i)=>{const x=46+i*540/metrics.length;text(label,x,y-8,9,bold,muted);text(value,x,y-29,18,bold);});y-=68;
 const widths=[133,34,78,119,58,59,59];
 function header(){ensure(62);text(shop.heading,36,y,11,bold);y-=26;let x=36;['MATERIAL','SIZE','VENDOR',shop.basis==='plannedQuantity'?'SHOP QTY':'BAGS / BLEND',shop.basis==='plannedQuantity'?'lb':'lb / BLEND','Qty in Stock','Qty to Order'].forEach((s,i)=>{page.drawRectangle({x,y:y-17,width:widths[i],height:32,color:pale});wrap(s,widths[i]-10,8,bold).forEach((part,j)=>text(part,x+5,y-j*10,8,bold,i>4?muted:ink));x+=widths[i];});y-=17;}
 header();
 for(const [index,row] of m.aggregates.entries()){
  const detail=shop.rows[index];
  const cells=[row.material,row.size,row.vendor,detail.instruction,n(detail.pounds),'—','—'].map((s,i)=>s==='—'?['—']:wrap(s,widths[i]-10,i===3?11:9,i===3?bold:regular));
  const length=Math.max(...cells.map(c=>c.length),1);let offset=0;
  if(y-(length*14+12)<68&&length*14+12<500){newPage();header();}
  while(offset<length){if(y-40<68){newPage();header();}const count=Math.min(length-offset,Math.floor((y-80)/14)),height=count*14+12;let x=36;
   for(let i=0;i<widths.length;i++){page.drawRectangle({x,y:y-height,width:widths[i],height,borderWidth:.4,borderColor:rgb(.72,.76,.81)});cells[i].slice(offset,offset+count).forEach((s,j)=>text(s,x+5,y-17-j*14,i===3?11:9,i===3?bold:regular,i>4?muted:ink));x+=widths[i];}y-=height;offset+=count;
  }
 }
 if(y-28<68){newPage();header();}
 page.drawRectangle({x:36,y:y-26,width:540,height:26,color:pale});
 text('TOTAL',41,y-17,10,bold);
 text(`${n(shop.rows.reduce((sum,row)=>sum+row.pounds,0))} lb`,36+widths.slice(0,4).reduce((a,b)=>a+b,0)+5,y-17,9,bold);
 y-=48;
 for(const filler of m.filler)line('Filler',`${filler.material}${filler.vendor?' / '+filler.vendor:''} — ${filler.quantity==null?'Production quantity unavailable':`${n(filler.quantity)} lb (${n(filler.perBatch)} lb/Batch × ${batches})${filler.package?` · ${n(filler.package.equivalent)} × ${n(filler.package.weightLb)} lb / ${filler.package.container}`:''}`}`);
 ensure(70);text(`BINDER — ${batches.toUpperCase()}`,36,y,11,bold);y-=21;
 line('Part A',`${m.binder.resinIdentity} — ${m.binder.resin?`${n(m.binder.resin.total)} US gal`:'Production quantity unavailable'}`);
 line('Part B',`${m.binder.hardenerIdentity} — ${m.binder.hardener?`${n(m.binder.hardener.total)} US gal`:'Production quantity unavailable'}`);
 for(const warning of m.warnings){line('Planning warning',warning);}
 for(let i=0;i<pages.length;i++){page=pages[i];text('Planning / staging quantities only. No inventory reserved or consumed.',36,48,8,regular,muted);text(`Plan ${plan.id||'Review'} · ${plan.status==='issued'?'Issued':'Working'}`,36,34,7,regular,muted);text(`Page ${i+1} of ${pages.length}`,506,20,8);}
 return new Uint8Array(await pdf.save());
}
