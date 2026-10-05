// @ts-nocheck -- real local JWTs, RPCs, RLS and Edge entry; no hosted access.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';import {transform} from 'esbuild';
import {handleProductionBlend} from '../supabase/functions/_shared/production-blend-handler.ts';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {accountHasCapability} from '../src/lib/rbac';
const root='/Users/chrisngo/source/repos/tenarten-inventory-ui';
const result=spawnSync('npx',['--yes','supabase@2.110.0','status','--workdir',root+'/.tmp-permission-supabase','-o','json'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
const cfg=JSON.parse(result.stdout);assert.equal(cfg.API_URL,'http://127.0.0.1:55481');
const sql=input=>{const r=spawnSync('docker',['exec','-i','supabase_db_tenops-permission-review','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
if(sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_users' and column_name='production_blend_manage')")==='f')sql(readFileSync('supabase/migrations/20261005170000_production_blend_capability.sql','utf8'));
const conf=JSON.parse(readFileSync(root+'/.tmp-permission-review/config.json'));const actors={};
for(const name of ['admin','member','outsider','support']){const client=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const signed=await client.auth.signInWithPassword({email:conf.actors[name].email,password:conf.actors[name].password});assert.ifError(signed.error);actors[name]={client,token:signed.data.session.access_token,id:signed.data.user.id};}
const access=(name,grant,client=actors.admin.client)=>client.rpc('admin_set_app_access_v2',{p_user_id:actors[name].id,p_display_name:'Local '+name,p_role:name==='support'?'guest':'member',p_is_active:true,p_read_only:name==='support',p_messaging_write:name==='support',p_production_blend_manage:grant});
// Exercise the actual Admin Edge update route, including older-client compatibility.
let adminHandler;
const adminEnv={SUPABASE_URL:cfg.API_URL,SUPABASE_ANON_KEY:cfg.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:cfg.SERVICE_ROLE_KEY,TENOPS_ALLOWED_ORIGINS:'http://localhost:4311'};
const adminSource=readFileSync('supabase/functions/admin-manage-users/index.ts','utf8').replace(/^import .*;\n/,'');
new Function('Deno','createClient',(await transform(adminSource,{loader:'ts',format:'cjs'})).code)({env:{get:k=>adminEnv[k]},serve:fn=>adminHandler=fn},createClient);
const adminRequest=(name,body)=>adminHandler(new Request('http://localhost:4311',{method:'POST',headers:{authorization:'Bearer '+actors[name].token,origin:'http://localhost:4311','content-type':'application/json'},body:JSON.stringify(body)}));
const update={action:'update',userId:actors.member.id,displayName:'Local member',role:'member',isActive:true,readOnly:false,messagingWrite:false,productionBlendManage:true};
assert.equal((await adminRequest('admin',update)).status,200);
assert.equal((await adminRequest('member',update)).status,403);
const oldUpdate={...update};delete oldUpdate.productionBlendManage;assert.equal((await adminRequest('admin',oldUpdate)).status,200);
assert.equal((await actors.member.client.rpc('get_my_app_access')).data[0].production_blend_manage,true,'Older client must not revoke an explicit grant');
assert.ifError((await access('member',true)).error);assert.ifError((await access('outsider',false)).error);assert.ifError((await access('support',false)).error);
assert.equal((await access('outsider',true,actors.member.client)).error?.code,'42501');
for(const [name,expected] of [['admin',true],['member',true],['outsider',false],['support',false]])assert.equal((await actors[name].client.rpc('has_app_capability',{p_capability:'production_blend.manage'})).data,expected,name);
for(const role of ['guest','member','lead','developer']){assert.equal(accountHasCapability(role,'production_blend.manage',false,true),false);assert.equal(accountHasCapability(role,'production_blend.manage',false,false,true),true);}
assert.equal(accountHasCapability('guest','production_blend.manage',true,true),false);
// Supply only source fixture data; all authentication, capability, RLS and persistence traffic uses local Supabase.
const sampleId=crypto.randomUUID(),fixture={...blendFixtures[4].snapshot,id:sampleId};
const clientFactory=(url,key,options)=>{const client=createClient(url,key,options);if(key!==cfg.ANON_KEY)return client;return {auth:client.auth,from:client.from.bind(client),rpc:(name,args)=>name==='get_sample_working_pdf_snapshot'?Promise.resolve({data:fixture}):client.rpc(name,args)};};
let handler;const entry=readFileSync('supabase/functions/generate-sample-pdf/index.ts','utf8');const block=entry.slice(entry.indexOf('const allowedOrigins'),entry.indexOf('export async function renderSampleWorkOrder'))+entry.slice(entry.indexOf('if (typeof Deno'));
const env={SUPABASE_URL:cfg.API_URL,SUPABASE_ANON_KEY:cfg.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:cfg.SERVICE_ROLE_KEY};
new Function('Deno','createClient','handleProductionBlend',(await transform(block,{loader:'ts',format:'cjs'})).code)({env:{get:k=>env[k]},serve:fn=>handler=fn},clientFactory,handleProductionBlend);
const request=(name,body)=>handler(new Request('http://localhost',{method:'POST',headers:{authorization:'Bearer '+actors[name].token,'content-type':'application/json'},body:JSON.stringify(body)}));
const inputs={batchCount:1,plannedQuantity:180,blendSize:1000};
for(const name of ['admin','member']){
 const response=await request(name,{action:'blend-save',sampleId,inputs});assert.equal(response.status,200,await response.clone().text());let plan=await response.json();
 assert.equal(plan.model.blendCount,.18);assert.equal(plan.model.filler[0].quantity,50);
 assert.equal((await request(name,{action:'blend-list',sampleId})).status,200);
 assert.equal((await request(name,{action:'blend-pdf',planId:plan.id})).status,200);
 const updated=await request(name,{action:'blend-save',planId:plan.id,revision:plan.revision,inputs});assert.equal(updated.status,200);plan=await updated.json();
 const issued=await request(name,{action:'blend-issue',planId:plan.id,revision:plan.revision,inputs});assert.equal(issued.status,200,await issued.clone().text());plan=await issued.json();
 assert.equal((await request(name,{action:'blend-pdf',planId:plan.id})).status,200);
 for(const denied of ['outsider','support']){
  for(const action of ['blend-context','blend-list','blend-save','blend-issue','blend-pdf'])assert.equal((await request(denied,{action,sampleId,planId:plan.id,inputs})).status,403,denied+action);
  assert.equal((await actors[denied].client.from('production_blend_plans').select('id').eq('id',plan.id)).data?.length,0);
  assert.equal((await actors[denied].client.rpc('persist_production_blend',{p_actor:actors.admin.id,p_id:null,p_revision:null,p_sample_id:sampleId,p_source_document_id:null,p_source_snapshot:{},p_inputs:{},p_model:{},p_issue:false})).error?.code,'42501');
 }
 const before=structuredClone(plan);assert.equal((await request(name,{action:'blend-save',planId:plan.id,revision:plan.revision,inputs})).status,422);
 assert.deepEqual((await actors[name].client.from('production_blend_plans').select('*').eq('id',plan.id).single()).data,before);
}
assert.ifError((await access('member',false)).error);assert.equal((await request('member',{action:'blend-list',sampleId})).status,403);
assert.equal((await actors.member.client.from('production_blend_plans').select('id').eq('sample_id',sampleId)).data?.length,0);
// Explicit Blend permission is independent even on a restricted account; it grants no Sample writes.
assert.ifError((await access('support',true)).error);assert.equal((await request('support',{action:'blend-save',sampleId,inputs})).status,200);
assert.equal((await actors.support.client.rpc('has_app_capability',{p_capability:'writeBusinessData'})).data,false);
assert.ifError((await access('support',false)).error);assert.equal((await actors.support.client.rpc('has_app_capability',{p_capability:'messaging.write'})).data,true);
const message=await actors.support.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:actors.member.id,p_body:'Local V1.1 independent-capability check'});assert.ifError(message.error);
assert.ifError((await access('member',true)).error); // Leave local review account explicitly enabled.
console.log('PASS real local JWT/API/RPC/RLS: Admin and explicit member create/read/update/issue/working+issued PDF; same-role and consultant denied; no self-grant; revocation; immutable issue; independent Messaging write; .18 Blend issue allowed.');
