import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {applyFormulationProfile,standardFormulationState,type FormulationRowInput,type SampleFormulationState} from '../src/modules/samples/formulation';
import {batchFirstProfile} from './support/sample-batch-first-fixture';
import {batchFirstQuantities} from '../supabase/functions/_shared/sample-batch-first.mjs';
import {projectSampleBatch} from '../supabase/functions/_shared/sample-batch-projection.mjs';
import {preparationDescription,exactPreparationDisplay} from '../src/modules/samples/preparation';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const close=(a:unknown,b:number)=>assert.ok(Math.abs(Number(a)-b)<1e-6,`${a} != ${b}`);
const rows:FormulationRowInput[]=[...[30,40,30].map((p,i):FormulationRowInput=>({componentRole:'aggregate',percentage:String(p),quantity:'',color:['Georgia White','Raven Black','Blue Gray'][i],unit:'oz',quantityProvenance:'calculated',calculationBasis:'target_total'})),...(['filler','resin','hardener'] as const).map((componentRole):FormulationRowInput=>({componentRole,percentage:'',quantity:'',calculationBasis:null,color:componentRole,quantityProvenance:'calculated',unit:componentRole==='filler'?'oz':'fl oz'}))];
const profile=structuredClone(batchFirstProfile);profile.name='Key Resin — 5:1';profile.batchContract.fillerSubstitution='equal_mass_preserve_yield_v1';
const old=applyFormulationProfile(standardFormulationState(),profile);
const scaled=structuredClone(old);for(const role of ['filler','resin'] as const)scaled.profile!.batchContract!.components[role]!.shopWorking!.rule='historical_volume_rate';
const cases=[[.5,32,9,7.5,1.5],[1,64,18,15,3],[1.25,80,22.5,18.75,3.75],[1.5,96,27,22.5,4.5],[2,128,36,30,6],[2.5,160,45,37.5,7.5],[4,256,72,60,12]];
for(const [factor,chips,filler,resin,hardener] of cases){
 const st={...scaled,width:String(12*factor)},q=batchFirstQuantities(st,rows),before=batchFirstQuantities({...old,width:st.width},rows);
 assert.deepEqual(q.rows.slice(3).map(r=>r.shop),[filler,resin,hardener]);close(q.availableChipMixOz,chips);close(q.rows[4].shop!/q.rows[5].shop!,5);
 // Independent Batch projection: base volume 1/32 divided by Batch volume 45/32.
 [50*16*factor/45,5*128*factor/45,128*factor/45].forEach((v,i)=>close(q.rows[i+3].exact,v));
 assert.deepEqual(q.canonical,before.canonical);assert.deepEqual(projectSampleBatch(st,rows),projectSampleBatch({...old,width:st.width},rows));
 assert.equal(preparationDescription(st,rows,3,q).label,'SHOP PREPARATION');
}
assert.equal(exactPreparationDisplay(320/9),'≈ 35.56');
const missing=structuredClone(scaled);delete missing.profile!.batchContract!.components.filler!.shopWorking;
const missingQ=batchFirstQuantities(missing,rows);close(missingQ.rows[3].shop,800/45);assert.equal(preparationDescription(missing,rows,3,missingQ).label,'EXACT BATCH PROJECTION');
const modified={...scaled,batchFillerOverrideLb:'100'},mq=batchFirstQuantities(modified,rows);close(mq.rows[3].shop,1600/45);close(mq.rows[4].shop,640/45);assert.match(preparationDescription(modified,rows,3,mq).note,/Modified Batch/);
const manual=rows.map((r):FormulationRowInput=>r.componentRole==='filler'?{...r,quantity:'21',quantityProvenance:'manual'}:r.componentRole==='resin'?{...r,quantity:'22',quantityProvenance:'manual'}:r);
for(const st of [scaled,{...scaled,width:'24'},modified]){const q=batchFirstQuantities(st,manual);assert.equal(q.rows[3].shop,21);assert.equal(q.rows[4].shop,22);close(q.rows[5].shop,4.4);}
const sherwin=structuredClone(scaled);sherwin.profile!.resinParts='4';sherwin.resinParts='4';sherwin.profile!.batchChipTargetLb='150';delete sherwin.profile!.batchContract!.components.filler!.shopWorking;
Object.assign(sherwin.profile!.batchContract!.components.resin!,{exact:null,authority:'unresolved'});sherwin.profile!.batchContract!.components.resin!.shopWorking!.quantity='16';
for(const factor of [.5,1,2,4]){const q=batchFirstQuantities({...sherwin,width:String(12*factor)},rows);assert.equal(q.rows[4].shop,16*factor);assert.equal(q.rows[5].shop,4*factor);assert.equal(q.canonical.resin,null);close(q.rows[3].shop,50*16*factor*(1/32)/(150/128));}
const mtt=structuredClone(scaled);mtt.profile!.name='MTT — 5:1';assert.equal(batchFirstQuantities({...mtt,width:'24'},rows).rows[4].shop,30);
const unresolved=structuredClone(missing);Object.assign(unresolved.profile!.batchContract!.components.filler!,{exact:null,authority:'unresolved'});delete unresolved.profile!.batchContract!.fillerSubstitution;
assert.equal(batchFirstQuantities(unresolved,rows).rows[3].shop,null);
const dir='/private/tmp/tenops-shop-scaling-pdfs';mkdirSync(dir,{recursive:true});
async function pdf(name:string,state:SampleFormulationState){const bytes=await renderSampleWorkOrder({colorPlateNumber:'T26-901-A',preparedBy:'Local review',formulation:state,blendRows:rows},'sample-work-order-pdf-v10-audience');writeFileSync(`${dir}/${name}.pdf`,bytes);const pdf=await getDocument({data:bytes,disableFontFace:true,useSystemFonts:true}).promise;let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await(await pdf.getPage(i)).getTextContent()).items.map(v=>'str' in v?v.str:'').join(' ');assert.equal(pdf.numPages,1);return text;}
const oldBefore=await pdf('historical', {...old,width:'24'});assert.match(oldBefore,/35\.555556/);assert.match(oldBefore,/28\.444444/);
for(const [name,state,values] of [['Key-2x',{...scaled,width:'24'},['36','30','6']],['Key-4x',{...scaled,width:'48'},['72','60','12']],['Sherwin-2x',{...sherwin,width:'24'},['32','8']]] as const){const text=await pdf(name,state);for(const v of values)assert.ok(text.includes(v));}
assert.equal(await pdf('historical-replay',{...old,width:'24'}),oldBefore);
assert.equal(old.profile!.batchContract!.components.filler!.shopWorking!.rule,'at_volume');
console.log('PASS: independent 0.5/1/1.25/1.5/2/2.5/4x, 5:1 + 4:1, MTT reference, missing/unresolved authority, modified Filler, manual overrides, unchanged exact/Batch projections, labels, one-page PDFs and historical v10 replay.');
