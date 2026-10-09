import assert from 'node:assert/strict';
import {standardFormulationState,BATCH_FIRST_VERSION} from '../src/modules/samples/formulation';
import {batchFirstQuantities} from '../supabase/functions/_shared/sample-batch-first.mjs';
import {batchFirstProfile} from './support/sample-batch-first-fixture';
import {applyPourLayout,convertPourUnits,defaultPourConstraints,finishedGeometry,geometryInputErrors,suggestPourLayouts,type PourConstraints} from '../src/modules/samples/pour-planning';
import {chipTotalMessage,sampleAttention} from '../src/modules/samples/sample-validation-view';
import {newLocalSample,type SampleBlendRow} from '../src/modules/samples/types';
const state={...standardFormulationState(),calculationVersion:BATCH_FIRST_VERSION,profile:structuredClone(batchFirstProfile)};
const rows=[{componentRole:'aggregate',percentage:'100',quantityProvenance:'calculated',unit:'oz'},...['filler','resin','hardener'].map(componentRole=>({componentRole,quantityProvenance:'calculated',unit:componentRole==='filler'?'oz':'fl oz'}))] as SampleBlendRow[];
// Independent reference ledger: rectangular inches arithmetic and rational Batch fractions,
// calculated outside the implementation (Python fractions), NOT outputs from the tested solver.
// Width/length/count, fixed columns, edge/gap, constraints, expected footprint and exact fraction.
type Case={id:string;w:number;l:number;n:number;c:number;edge?:string;gap?:string;limits?:Partial<PourConstraints>;width:number;length:number;fraction:[number,number];rotated?:boolean};
const cases:Case[]=[
 {id:'A',w:6,l:6,n:4,c:2,width:12,length:12,fraction:[1,45]},
 {id:'B',w:6,l:6,n:6,c:3,width:18,length:12,fraction:[1,30]},
 {id:'C',w:8,l:8,n:4,c:2,width:16,length:16,fraction:[16,405]},
 {id:'D',w:8,l:8,n:8,c:4,width:32,length:16,fraction:[32,405]},
 {id:'E',w:4,l:8,n:4,c:2,width:8,length:16,fraction:[8,405]},
 {id:'F',w:6,l:6,n:7,c:1,width:6,length:42,fraction:[7,180]},
 {id:'G',w:8,l:4,n:4,c:2,limits:{rotate:true,maxWidth:'8',maxLength:'16'},width:8,length:16,fraction:[8,405],rotated:true},
 {id:'H',w:8,l:8,n:8,c:1,limits:{adjustWidth:false},width:12,length:64,fraction:[16,135]},
 {id:'I',w:6,l:6,n:4,c:2,limits:{adjustLength:false},width:12,length:20,fraction:[1,27]},
 {id:'J',w:6,l:6,n:4,c:2,limits:{maxWidth:'12',maxLength:'12'},width:12,length:12,fraction:[1,45]},
 {id:'K',w:6,l:6,n:4,c:2,edge:'1',width:14,length:14,fraction:[49,1620]},
 {id:'L',w:6,l:6,n:4,c:2,gap:'.25',width:12.25,length:12.25,fraction:[2401,103680]},
 {id:'M',w:6,l:6,n:4,c:2,edge:'1',gap:'.25',width:14.25,length:14.25,fraction:[361,11520]},
 {id:'P',w:8,l:8,n:8,c:1,gap:'.125',limits:{adjustWidth:false,maxLength:'70',rotate:true},width:12,length:64.875,fraction:[173,1440]},
 {id:'Q',w:8,l:8,n:8,c:2,edge:'.5',gap:'.25',limits:{maxWidth:'20',maxLength:'40'},width:17.25,length:33.75,fraction:[23,256]}
];
const near=(a:number|null,b:number,message:string,tolerance=1e-9)=>assert.ok(a!==null&&Math.abs(a-b)<tolerance,`${message}: actual ${a}; expected ${b}`);
for(const c of cases){
 const source={...state,finishedPlateWidth:String(c.w),finishedPlateLength:String(c.l),finishedPlateQuantity:String(c.n),...(c.id==='I'?{length:'20'}:{})};
 const before=JSON.stringify(source);
 const result=suggestPourLayouts(source,c.edge??'0',c.gap??'0',{...defaultPourConstraints,arrangement:'fixed',columns:String(c.c),rotate:false,...c.limits});
 assert.equal(result.issue,null,c.id);const p=result.layouts[0];assert.ok(p,c.id);assert.equal(p.columns,c.c);assert.equal(p.rows,Math.ceil(c.n/c.c));assert.equal(p.rotated,Boolean(c.rotated));
 assert.equal(p.widthIn,c.width,c.id);assert.equal(p.lengthIn,c.length,c.id);assert.equal(p.thicknessIn,.375);
 // Reference geometric volume and ingredient quantities use only the independent ledger and captured 180/50/5/1 authority.
 const fraction=c.fraction[0]/c.fraction[1], volume=c.width*c.length*.375/1728;
 near(p.area,c.width*c.length/144,c.id+' area');near(p.volume,volume,c.id+' volume');near(finishedGeometry(source).volume,c.w*c.l*c.n*.375/1728,c.id+' finished CFT');
 const applied={...source,...applyPourLayout(source,p)}, actual=batchFirstQuantities(applied,rows);
 near(actual.fraction,fraction,c.id+' fraction');near(actual.rows[0].exact,2880*fraction,c.id+' chips');near(actual.rows[1].exact,800*fraction,c.id+' filler');near(actual.rows[2].exact,640*fraction,c.id+' A');near(actual.rows[3].exact,128*fraction,c.id+' B');near(Number(actual.dryPoolOz),3680*fraction,c.id+' dry',.000001);
 const manual=rows.map(r=>r.componentRole==='filler'?{...r,quantity:'22',quantityProvenance:'manual' as const}:r);assert.equal(batchFirstQuantities(applied,manual).rows[1].shop,22);
 for(const key of ['finishedPlateWidth','finishedPlateLength','finishedPlateQuantity','thicknessIn','profile'] as const)assert.deepEqual(applied[key],source[key]);
 assert.equal(JSON.stringify(source),before);
 console.log(`${c.id}: ${p.columns}×${p.rows} → ${c.width}×${c.length} in; CFT ${volume}; Batch ${c.fraction.join('/')}; chips ${actual.rows[0].exact}; Filler ${actual.rows[1].exact}; A/B ${actual.rows[2].exact}/${actual.rows[3].exact}; dry ${actual.dryPoolOz} — MATCH`);
}
const feet=convertPourUnits(state,'ft');assert.equal(feet.width,'1');assert.deepEqual(convertPourUnits(feet,'in'),state);
for(const limits of [{maxWidth:'5'},{maxLength:'5'},{adjustWidth:false,maxWidth:'5'},{adjustLength:false,maxLength:'5'}])assert.ok(suggestPourLayouts(state,'0','0',{...defaultPourConstraints,...limits}).issue);
for(const key of ['width','length','thicknessIn','finishedPlateQuantity'] as const)assert.ok(geometryInputErrors({...state,[key]:'0'}).some(e=>e.key===key));
assert.ok(geometryInputErrors({...state,finishedPlateQuantity:'1.5'}).length);assert.ok(geometryInputErrors({...state,width:'Infinity'}).length);
assert.equal(chipTotalMessage('120',false),'Blend exceeds 100% by 20%. Reduce aggregate percentages.');assert.equal(chipTotalMessage('85',false),'Blend is 15% short of 100%.');assert.equal(chipTotalMessage('100',true),'');assert.equal(chipTotalMessage('100.0004',true),'');
const missing=newLocalSample({preparedBy:'Local review',formulation:{...state,profile:null}});assert.ok(sampleAttention(missing).some(i=>i.section==='formulation-setup'));
console.log('PASS independent A–R arithmetic, locks/maxima/allowances/rotation, units, Apply, manual quantities, geometry feedback and unchanged reconciliation tolerance. Multi-edit event order covered by browser flow.');
