/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic PostgREST fixture payloads include deliberate invalid inputs. */
/** Focused delta: apply only the forward migration on the isolated local stack. */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createClient,type SupabaseClient } from '@supabase/supabase-js';
import { localConfig,sql } from './support/production-contact-local.mjs';
import { captureChoice } from '../src/modules/production/contacts/model';
const cfg=localConfig(),checks:string[]=[],migration='20261014210000_production_customer_list.sql';
const historical=sql("select coalesce(jsonb_agg(to_jsonb(j) order by id),'[]') from public.jobs j;");
if(sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='production_companies' and column_name='archived_at');")!=='t'){
 sql(await readFile('supabase/migrations/'+migration,'utf8'));sql("notify pgrst,'reload schema';");
}
assert.equal(sql("select coalesce(jsonb_agg(to_jsonb(j) order by id),'[]') from public.jobs j;"),historical,'Forward migration leaves all historical Jobs byte-equivalent');checks.push('Forward migration preserves all existing Jobs, text and snapshots');
const accounts=JSON.parse(await readFile('.tmp-contact-review/accounts.json','utf8')),actors:Record<string,SupabaseClient>={};
for(const a of accounts){const c=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.ifError((await c.auth.signInWithPassword({email:a.email,password:a.password})).error);actors[a.email.split('@')[0].slice('contact-'.length)]=c;}
const anon=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false}});
const denied=(r:any)=>{assert(r.error,'Expected permission denial');assert.equal(r.error.code,'42501',JSON.stringify(r.error));};
const save=async(role:string,company:any,contact:any=null)=>{const r=await actors[role].rpc('save_production_customer',{p_company:company,p_contact:contact});assert.ifError(r.error);return r.data;};
const search=async(name:string,offset=0)=>{const r=await actors.member.rpc('search_production_customers',{p_search:name,p_offset:offset});assert.ifError(r.error);return r.data;};
const tag='Customer QA '+Date.now();
const simple=await save('member',{name:tag+' Superior'});assert.equal(simple.contact,null);
const rich=await save('member',{name:tag+' Buslam'},{name:'Optional Person',phone:'555-0401',email:'optional@example.invalid'});
assert.equal(rich.company.default_contact_id,rich.contact.id);
assert.equal((await search(tag+' Buslam')).length,1,'One customer row, no extra person selection');
assert.equal((await search(tag+' Buslam'))[0].contact.name,'Optional Person');checks.push('Member creates company-only/optional-contact customers; one-step lookup captures optional saved information');
const second=await actors.member.rpc('save_production_contact',{p_company:rich.company,p_contact:{name:'Existing retained person'}});assert.ifError(second.error);
const list=await actors.lead.rpc('list_production_company_contacts',{p_company_id:rich.company.id});assert.ifError(list.error);assert.equal(list.data?.length,2);
assert.equal((await search(tag+' Buslam')).length,1);checks.push('Existing contact records and legacy save contract retained without multiplying customer choices');
const captured=captureChoice(rich);const created=await actors.member.from('jobs').insert({name:tag+' Job',customer:rich.company.name,...captured,remarks:'Keep remarks',estimated_man_hours:7}).select('*').single();assert.ifError(created.error);
const before=created.data;
for(const role of ['member','guest','developer','reader','inactive']){
 denied(await actors[role].rpc('save_production_customer',{p_company:{...rich.company,name:'Forbidden'},p_contact:rich.contact}));
 denied(await actors[role].rpc('archive_production_customer',{p_company_id:rich.company.id,p_expected_updated_at:rich.company.updated_at}));
}
denied(await anon.rpc('archive_production_customer',{p_company_id:rich.company.id,p_expected_updated_at:rich.company.updated_at}));
denied(await actors.member.from('production_companies').update({archived_at:new Date().toISOString()}).eq('id',rich.company.id));checks.push('Shared edits/archive denied to Member, Guest, Developer, read-only, inactive and anonymous; direct write bypass denied');
const edited=await save('lead',{...rich.company,name:tag+' Buslam Updated'},{...rich.contact,phone:'555-CHANGED'});
assert.equal(edited.contact.phone,'555-CHANGED');assert.deepEqual((await actors.member.from('jobs').select('*').eq('id',before.id).single()).data,before);
const stale=await actors.admin.rpc('save_production_customer',{p_company:rich.company,p_contact:rich.contact});assert.equal(stale.error?.code,'55000');
const staleArchive=await actors.admin.rpc('archive_production_customer',{p_company_id:rich.company.id,p_expected_updated_at:rich.company.updated_at});assert.equal(staleArchive.error?.code,'55000');checks.push('Lead editing preserves historical capture; stale edit and archive preconditions rejected immediately');
const archived=await actors.admin.rpc('archive_production_customer',{p_company_id:edited.company.id,p_expected_updated_at:edited.company.updated_at});assert.ifError(archived.error);
assert.equal((await search(tag+' Buslam')).length,0);
const oldSearch=await actors.member.rpc('search_production_contacts',{p_search:tag+' Buslam'});assert.ifError(oldSearch.error);assert.equal(oldSearch.data?.length,0);
const retained=await actors.member.rpc('get_production_contact',{p_company_id:edited.company.id,p_contact_id:edited.contact.id});assert.ifError(retained.error);assert(retained.data.company.archived_at);assert.equal(retained.data.contact.id,edited.contact.id);
assert.deepEqual((await actors.member.from('jobs').select('*').eq('id',before.id).single()).data,before);
const forbiddenJob=await actors.member.from('jobs').insert({name:'Archived link forbidden',customer:edited.company.name,...captureChoice(edited)});assert.equal(forbiddenJob.error?.code,'55000');
assert.ifError((await actors.member.from('jobs').update({remarks:'Allowed historical edit'}).eq('id',before.id)).error);
assert.ifError((await actors.member.from('jobs').update({customer_contact_snapshot:{...before.customer_contact_snapshot,contact_phone:'Historical Project override'}}).eq('id',before.id)).error);
const blocked=await actors.lead.rpc('save_production_customer',{p_company:edited.company,p_contact:edited.contact});assert.equal(blocked.error?.code,'55000');checks.push('Archive hides configured choices in both search APIs, retains contact rows/Job snapshots, blocks new linked Jobs and permits historical Job editing');
const historicalName=await actors.member.from('jobs').insert({name:tag+' Historical name',customer:before.customer}).select('*').single();assert.ifError(historicalName.error);assert.equal(historicalName.data.customer_company_id,null);
const promoted=await save('member',{name:before.customer});assert.notEqual(promoted.company.id,rich.company.id);assert.equal((await actors.member.from('jobs').select('customer_company_id').eq('id',historicalName.data.id).single()).data?.customer_company_id,null);checks.push('Archived names remain usable as historical text; explicit promotion creates independent identity without modifying old Jobs');
const changedDefault=await save('admin',simple.company,{name:'Default Optional Person'});assert(changedDefault.company.default_contact_id);
const clear=await save('admin',changedDefault.company,null);assert.equal(clear.company.default_contact_id,null);assert.equal((await actors.member.rpc('get_production_contact',{p_company_id:simple.company.id,p_contact_id:changedDefault.contact.id})).data.contact.name,'Default Optional Person');checks.push('Explicit optional default-contact assignment/removal preserves existing contact records');
for(let i=0;i<22;i++)await save('member',{name:tag+' Page '+String(i).padStart(2,'0')});
const page1=await search(tag+' Page'),page2=await search(tag+' Page',20);assert.equal(page1.length,21);assert.equal(page2.length,2);assert.equal(new Set([...page1.slice(0,20),...page2].map((row:any)=>row.company.id)).size,22);assert.deepEqual(await search(tag+' Page'),page1);
assert.equal((await search('%')).length,0);denied(await actors.inactive.rpc('search_production_customers',{p_search:''}));denied(await anon.rpc('search_production_customers',{p_search:''}));checks.push('Bounded stable customer pagination, literal search escaping, inactive/anonymous read denial');
// Simple demonstration names. No name merge or Production writes.
await save('member',{name:'Superior'});await save('member',{name:'Buslam'});
await writeFile('output/customer-list/database.json',JSON.stringify({checks,migration,localUrl:cfg.API_URL,hostedWrites:false,reusedEvidence:'docs/project-memory/evidence/2026-10-14-production-contacts.json'},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,checks},null,2));
