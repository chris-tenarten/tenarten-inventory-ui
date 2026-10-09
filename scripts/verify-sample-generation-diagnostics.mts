import assert from 'node:assert/strict';
import {generationDiagnostic,readGenerationDiagnostic,diagnosticResponse} from '../supabase/functions/_shared/sample-diagnostics.mjs';
import {handleProductionBlend} from '../supabase/functions/_shared/production-blend-handler';
const state={resinParts:'5',hardenerParts:'1',thicknessIn:'.75',profile:{resinParts:'5',hardenerParts:'1'},derived:{productionVolumeCft:null}};
const error={message:'Complete the shop preparation quantities before issuing.',token:'SECRET',stack:'SECRET',details:'SECRET'};
const d=generationDiagnostic(error,'issue-snapshot',{state,draftState:state,source:'captured-snapshot'});
assert.equal(d.code,'SAMPLE_PREPARATION_INCOMPLETE');assert.equal(d.stage,'issue-snapshot');assert.deepEqual(d.observations.savedCapturedRatio,{resin:'5',hardener:'1'});assert.equal(d.observations.thicknessIn,'.75');assert.equal(d.observations.backendResolvedRatio,'unavailable');assert.equal(d.observations.generationPayloadRatio,'unavailable');assert.equal(d.correlationId,'unavailable');assert(!JSON.stringify(d).includes('SECRET'));
const client=(role:string,is_active=true)=>({rpc:async(name:string)=>({data:name==='get_my_app_user'?[{role,is_active}]:false})});
for(const role of ['member','consultant'])assert.deepEqual(await diagnosticResponse(client(role),error,'issue-snapshot'),{});
assert.deepEqual(await diagnosticResponse(client('admin',false),error,'issue-snapshot'),{});for(const role of ['admin','developer'])assert((await diagnosticResponse(client(role),error,'issue-snapshot')).diagnostic);
const clean=readGenerationDiagnostic({...d,explanation:'SECRET',payload:'SECRET',actual:'SECRET',observations:{...d.observations,thicknessIn:'SECRET',savedCapturedRatio:{resin:'SECRET',hardener:'1'}}});assert(!JSON.stringify(clean).includes('SECRET'));
for(const [stage,code] of [['pdf-render','PDF_RENDER_FAILED'],['storage-upload','PDF_STORAGE_FAILED'],['delivery','PDF_DELIVERY_FAILED']])assert.equal(generationDiagnostic(new Error('SECRET'),stage).code,code);
assert.equal(generationDiagnostic({message:'invalid ratio'},'client-validation').code,'SAMPLE_RATIO_INVALID');
for(const role of ['admin','member']){const r=await handleProductionBlend({user:client(role),service:{},body:{action:'blend-issue'},headers:{}});assert.equal(r.status,403);const b=await r.json();assert.equal(Boolean(b.diagnostic),role==='admin');if(b.diagnostic){assert.equal(b.diagnostic.stage,'authorization');assert.match(b.diagnostic.correlationId,/^[0-9a-f-]{36}$/);}}
const admin={rpc:async(name:string)=>({data:name==='get_my_app_user'?[{role:'admin',is_active:true}]:true})};
const bad=await handleProductionBlend({user:admin,service:{},body:{action:'bad',payload:'SECRET'},headers:{}});assert.equal(bad.status,400);const b=await bad.json();assert.equal(b.diagnostic.code,'GENERATION_REQUEST_INVALID');assert(!JSON.stringify(b).includes('SECRET'));
console.log('PASS sanitized fields, accurate preparation/ratio distinction, unavailable values, active Admin/Developer backend metadata, no operation permission changes, correlation ID, request/render/storage/delivery categories.');
