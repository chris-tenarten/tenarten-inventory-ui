// Focused P1 rerun of independent QA's synthetic image. Real vision/reasoning,
// actual local review/approval handler, synthetic catalog/records. Never a DB.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createTenbotLiveDemo,type DemoDraft} from './support/tenbot-live-demo.mjs';
import type {LocalRowEdit} from '../src/modules/tenbot/live-review';

type DemoResponse={attachmentId:string;localDemo:{draft:DemoDraft};agent:{status:string;evidence:{tool:string}[]};draft:DemoDraft;receivals:Record<string,unknown>[];onHandChanged:boolean;createdCount:number};
const model='gpt-6.1-terra' as const;
const imagePath='scripts/fixtures/tenbot-invoice-quantity-qa.png';
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)??'/private/tmp/tenops-tenbot-p1-2026-10-29/quantity-live.json';
const fixture=JSON.parse(readFileSync('scripts/fixtures/tenbot-invoice.synthetic.json','utf8'));
const owner='10282026-0000-4000-8000-000000000021';
const receivals={complete:true,rows:[
  {id:'offline-existing-aw',vendor:'T&M Supply',material_name:'Alaska White',size:'#1',quantity_expected:'3',quantity_received:'0',unit:'Bag',status:'pending'},
  {id:'offline-existing-res',vendor:'T&M Supply',material_name:'Clear Resin',size:'Part A',quantity_expected:'2',quantity_received:'0',unit:'Pail',status:'pending'},
]};
const details={orderedBy:'Synthetic QA Employee',orderDate:'2026-10-28',location:'Denton'};
const edits=(draft:DemoDraft):LocalRowEdit[]=>draft.rows.map(({lineId,materialId,quantity,unit,jobId,excluded,catalogRequest,duplicateAcknowledgement})=>({lineId,materialId,quantity,unit,jobId,excluded,catalogRequest:catalogRequest??null,duplicateAcknowledgement:duplicateAcknowledgement??null}));
const targets=(draft:DemoDraft)=>draft.rows.filter(row=>!row.excluded);

if(!process.argv.includes('--run')){
  console.log(JSON.stringify({mode:'PLAN ONLY; no credential/provider access, API call or write',model,imagePath,output,scope:'Exact QA150LB/10GAL live transcription and autonomous tool preparation, then unsafe edit/review/approve rejection and correct3Bag/2Pail local-memory approval. No database or new model comparison.',budget:'Existing cumulative $5 server reservation ledger, unchanged.'},null,2));
}else{
  if(existsSync(output))throw Error('Existing P1 live receipt must be reviewed before a new attempt.');
  mkdirSync('/private/tmp/tenops-tenbot-p1-2026-10-29',{recursive:true});
  const measured=await import('./support/tenbot-live-provider.mjs');
  const receipt:Record<string,unknown>={state:'started',model,mode:'Actual OpenAI image interpretation and model-directed tools; synthetic local catalog/duplicate responses and in-memory pending simulation, no database/JWT/RLS claim.',image:{path:imagePath,sha256:createHash('sha256').update(readFileSync(imagePath)).digest('hex')},journalBefore:measured.getJournal(),sourcePins:['scripts/reconcile-tenbot-quantity-live.mts','src/modules/inventory/invoice-quantity.ts','supabase/functions/_shared/tenbot-invoice.ts','scripts/support/tenbot-live-demo.mts','scripts/support/tenbot-live-provider.mts'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),requests:[]};
  const requests=receipt.requests as unknown[];
  const save=()=>{receipt.network=measured.getNetworkReceipts();receipt.journalAfter=measured.getJournal();writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});};
  const handler=createTenbotLiveDemo({model,catalog:fixture.catalog,receivals,can:async(caller)=>caller===owner,remainingUsd:()=>5-measured.getJournal().reservedOrSpentUsd,assertNoFatal:measured.assertNoFatal,createProvider:(label,attachment)=>measured.createMeasuredProvider(model,'p1-quantity/'+label,attachment)});
  async function call(body:Record<string,unknown>){const start=performance.now();try{const response=await handler(body,owner);requests.push({request:body.action==='upload'?{...body,attachment:{filename:'tenbot-invoice-quantity-qa.png',mediaType:'image/png',sha256:receipt.image}}:body,response,durationMs:Math.round(performance.now()-start)});save();return response as unknown as DemoResponse;}catch(error){requests.push({request:body,status:(error as {status?:number}).status,error:(error as Error).message,durationMs:Math.round(performance.now()-start)});save();throw error;}}
  try{
    measured.assertNoFatal();
    const uploaded=await call({action:'upload',syntheticConfirmed:true,attachment:{filename:'tenbot-invoice-quantity-qa.png',mediaType:'image/png',dataBase64:readFileSync(imagePath).toString('base64')}});
    const answer=await call({action:'ask',attachmentId:uploaded.attachmentId,question:'Prepare pending receivals for the materials on this synthetic invoice. Investigate the catalog and potential duplicates. Do not create any records.',orderDetails:details});
    let draft:DemoDraft=answer.localDemo?.draft;assert(draft,'Actual model must produce a receival proposal');
    assert.equal(answer.agent.status,'completed');
    const sourceCalls=answer.agent.evidence.map((entry:{tool:string})=>entry.tool);
    for(const tool of ['read_invoice','search_catalog','check_receival_duplicates','prepare_pending_receivals'])assert(sourceCalls.includes(tool),tool);
    assert.deepEqual(targets(draft).map(row=>[row.materialName,row.sourceQuantity?.quantity,row.sourceQuantity?.unit,row.quantity,row.unit]),[['Alaska White','150','LB','3','Bag'],['Clear Resin','10','GAL','2','Pail']]);
    const original=targets(draft).map(row=>JSON.stringify(row.sourceQuantity));
    const wrong=edits(draft).map(row=>({...row,quantity:row.materialId==='standard:synthetic-aw1'?'150':row.materialId==='standard:synthetic-res5'?'10':row.quantity,duplicateAcknowledgement:null}));
    draft=(await call({action:'review',draftId:draft.id,revision:draft.revision,edits:wrong,orderDetails:details})).draft;
    assert.equal(draft.canApprove,false);assert(targets(draft).every(row=>row.reasons.includes('source_quantity_mismatch')));
    const acknowledged=edits(draft).map(row=>({...row,duplicateAcknowledgement:draft.rows.find(source=>source.lineId===row.lineId)?.duplicateReview?.canAcknowledge?draft.rows.find(source=>source.lineId===row.lineId)!.duplicateReview!.fingerprint:null}));
    draft=(await call({action:'review',draftId:draft.id,revision:draft.revision,edits:acknowledged,orderDetails:details})).draft;
    assert.equal(draft.canApprove,false);
    await assert.rejects(call({action:'approve',draftId:draft.id,revision:draft.revision,hash:draft.hash,confirmation:true}),(error:{status?:number})=>error.status===409);
    const corrected=edits(draft).map(row=>({...row,quantity:row.materialId==='standard:synthetic-aw1'?'3':row.materialId==='standard:synthetic-res5'?'2':row.quantity,duplicateAcknowledgement:null}));
    draft=(await call({action:'review',draftId:draft.id,revision:draft.revision,edits:corrected,orderDetails:details})).draft;
    const fresh=edits(draft).map(row=>({...row,duplicateAcknowledgement:draft.rows.find(source=>source.lineId===row.lineId)?.duplicateReview?.canAcknowledge?draft.rows.find(source=>source.lineId===row.lineId)!.duplicateReview!.fingerprint:null}));
    draft=(await call({action:'review',draftId:draft.id,revision:draft.revision,edits:fresh,orderDetails:details})).draft;
    assert.equal(draft.canApprove,true);assert.deepEqual(targets(draft).map(row=>JSON.stringify(row.sourceQuantity)),original);
    const approved=await call({action:'approve',draftId:draft.id,revision:draft.revision,hash:draft.hash,confirmation:true});
    assert.deepEqual(approved.receivals.map((row:Record<string,unknown>)=>[row.quantity_expected,row.unit,row.quantity_received]),[[3,'Bag',0],[2,'Pail',0]]);
    assert.equal(approved.onHandChanged,false);
    receipt.state='passed';receipt.correctedQuantities=targets(draft).map(row=>({material:row.materialName,source:row.sourceQuantity,quantity:row.quantity,unit:row.unit,basis:row.quantityBasis}));receipt.simulatedCreated=approved.createdCount;receipt.databaseRequests=0;receipt.operationalWrites=0;
  }catch(error){receipt.state='failed';receipt.error=(error as Error).message;process.exitCode=1;}
  finally{save();measured.closeBudget();}
  const network=measured.getNetworkReceipts();
  receipt.measuredCostUsd=network.reduce((sum,row)=>sum+Number(row.accountedUsd??0),0);receipt.calls=network.length;save();
  console.log(JSON.stringify({state:receipt.state,output,calls:receipt.calls,measuredCostUsd:receipt.measuredCostUsd,journalAfter:receipt.journalAfter,error:receipt.error},null,2));
}
