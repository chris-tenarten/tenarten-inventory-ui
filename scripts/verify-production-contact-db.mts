/* eslint-disable @typescript-eslint/no-explicit-any -- Untyped PostgREST fixtures exercise rejected payloads too. */
/** Real local JWT/PostgREST/RLS/RPC checks. Refuses hosted endpoints. */
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { localConfig,sql } from './support/production-contact-local.mjs';
import { captureChoice,emptySnapshot } from '../src/modules/production/contacts/model';
import { productionValuesEqual } from '../src/modules/production/update-normalization';
const cfg=localConfig(), checks:string[]=[];
const accounts=JSON.parse(await readFile('.tmp-contact-review/accounts.json','utf8'));
const actors:Record<string,SupabaseClient>={};
for(const a of accounts){
 const client=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.ifError((await client.auth.signInWithPassword({email:a.email,password:a.password})).error);
 actors[a.email.split('@')[0].slice('contact-'.length)]=client;
}
const anon=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false}});
const denied=(r:any)=>{assert(r.error,'Expected denial');assert.equal(r.error.code,'42501',JSON.stringify(r.error));};
async function save(actor:string,company:any,contact:any=null){const r=await actors[actor].rpc('save_production_contact',{p_company:company,p_contact:contact});assert.ifError(r.error);return r.data;}
async function get(company:string,contact:string|null=null){const r=await actors.member.rpc('get_production_contact',{p_company_id:company,p_contact_id:contact});assert.ifError(r.error);return r.data;}
const tag='QA '+Date.now();
const companyOnly=await save('member',{name:tag+' Company Only'});
assert.equal(companyOnly.contact,null);assert.equal(companyOnly.company.email,'');checks.push('Company-only creation with all supplemental fields omitted');
const named=await save('member',{name:tag+' Stoneworks',phone:'555-0100',email:'office@example.invalid',mailing_address:'100 Local Test Lane',notes:'Company note'},{name:'Alex Contact',email:'alex@example.invalid',phone:'555-0101',title:'Coordinator',notes:'Contact note'});
const second=await save('member',named.company,{name:'Blair Contact'});
assert.equal(second.company.id,named.company.id);assert.notEqual(second.contact.id,named.contact.id);checks.push('Named contact, optional fields, multiple people in one company');
for(const role of ['guest','developer','reader','inactive'])denied(await actors[role].rpc('save_production_contact',{p_company:{name:'Forbidden'},p_contact:null}));
denied(await anon.rpc('save_production_contact',{p_company:{name:'Forbidden'}}));
for(const role of ['member','guest','developer','reader','inactive']){
 denied(await actors[role].rpc('save_production_contact',{p_company:{...named.company,name:'Unauthorized shared company edit'},p_contact:null}));
 denied(await actors[role].rpc('save_production_contact',{p_company:named.company,p_contact:{...named.contact,name:'Unauthorized shared contact edit'}}));
}
for(const table of ['production_companies','production_contacts']){
 denied(await actors.admin.from(table).insert({name:'Direct bypass'}));
 denied(await actors.admin.from(table).update({name:'Direct bypass'}).eq('id',named.company.id));
 denied(await actors.admin.from(table).delete().eq('id',named.company.id));
 for(const role of ['inactive']){const r=await actors[role].from(table).select('*');assert.ifError(r.error);assert.equal(r.data?.length,0);}
 denied(await anon.from(table).select('*'));
}
checks.push('RPC-only writes, no deletion API, Member/Guest/Developer/read-only/inactive shared edit denial, anonymous denial');
const historical=await actors.member.from('jobs').select('*').eq('job_number','LOCAL-HISTORICAL').single();assert.ifError(historical.error);
assert.equal(historical.data.customer,'Historical Stoneworks');assert.equal(historical.data.customer_company_id,null);assert.equal(historical.data.customer_contact_snapshot,null);
const snapshot=captureChoice(named);
const created=await actors.member.from('jobs').insert({name:tag+' Project',customer:named.company.name,...snapshot,remarks:'Keep unrelated remarks',contract_value:123.45,estimated_man_hours:12}).select('*').single();assert.ifError(created.error);
const jobId=created.data.id;
const updatedShared=await save('lead',named.company,{...named.contact,email:'changed@example.invalid'});
assert.equal(updatedShared.contact.email,'changed@example.invalid');
const reopened=await actors.member.from('jobs').select('*').eq('id',jobId).single();assert.ifError(reopened.error);assert.deepEqual(reopened.data.customer_contact_snapshot,snapshot.customer_contact_snapshot);
const oldContactStale=await actors.admin.rpc('save_production_contact',{p_company:named.company,p_contact:{...named.contact,email:'stale@example.invalid'}});assert.equal(oldContactStale.error?.code,'55000',JSON.stringify({before:named.contact.updated_at,after:updatedShared.contact.updated_at,error:oldContactStale.error,returned:oldContactStale.data?.contact}));
const editedSnapshot={...snapshot.customer_contact_snapshot,contact_phone:'PROJECT ONLY'};
assert.ifError((await actors.member.from('jobs').update({customer_contact_snapshot:editedSnapshot}).eq('id',jobId)).error);
assert.equal((await get(named.company.id,named.contact.id)).contact.phone,'555-0101');
const refreshed=captureChoice(await get(named.company.id,named.contact.id));
assert.ifError((await actors.member.from('jobs').update({...refreshed,customer:refreshed.customer_contact_snapshot!.company_name}).eq('id',jobId)).error);
const final=await actors.member.from('jobs').select('*').eq('id',jobId).single();assert.ifError(final.error);
assert.equal(final.data.customer_contact_snapshot.contact_email,'changed@example.invalid');
for(const key of Object.keys(created.data))if(!['updated_at','customer_contact_snapshot'].includes(key))assert.deepEqual(final.data[key],created.data[key],key+' remained unchanged');
checks.push('Project create/save/reopen, shared-edit snapshot preservation, Project-only override, explicit refresh, unrelated fields preserved');
const adminCompany=await save('admin',{...companyOnly.company,name:tag+' Company Renamed'});assert.equal(adminCompany.company.name,tag+' Company Renamed');
const other=await save('member',{name:tag+' Stoneworks'});assert.notEqual(other.company.id,named.company.id);checks.push('Lead/Admin shared edits; stale save rejection; duplicate names do not merge');
let r=await actors.member.from('jobs').update({customer_company_id:other.company.id,customer_contact_id:named.contact.id}).eq('id',jobId);assert.equal(r.error?.code,'23503');
r=await actors.member.from('jobs').update({customer_contact_snapshot:{...emptySnapshot(named.company.name),secret_bid_notes:'Forbidden shape'}}).eq('id',jobId);assert.equal(r.error?.code,'22023');
r=await actors.member.from('jobs').update({customer_contact_snapshot:{company_name:'Wrong company'}}).eq('id',jobId);assert.equal(r.error?.code,'22023');
r=await actors.member.from('jobs').update({customer_contact_snapshot:null}).eq('id',jobId);assert.equal(r.error?.code,'22023');
for(const role of ['guest','developer'])denied(await actors[role].from('jobs').update({customer_contact_snapshot:emptySnapshot(named.company.name)}).eq('id',jobId));
const reader=await actors.reader.from('jobs').update({customer_contact_snapshot:emptySnapshot(named.company.name)}).eq('id',jobId).select();assert(reader.error||reader.data?.length===0);
checks.push('Mismatched company/contact FK denial, snapshot whitelist/length/identity validation, unauthorized Project capture denial');
assert.ifError((await actors.member.from('jobs').update({customer:'Legacy text edit'}).eq('id',jobId)).error);
const detached=await actors.member.from('jobs').select('*').eq('id',jobId).single();assert.ifError(detached.error);assert.equal(detached.data.customer_company_id,null);assert.equal(detached.data.customer_contact_snapshot,null);
const noCustomer=await actors.member.from('jobs').insert({name:tag+' No Customer'}).select('*').single();assert.ifError(noCustomer.error);assert.equal(noCustomer.data.customer,null);
checks.push('Legacy text-only editing safely detaches links; historical Jobs and optional customer remain compatible');
const prefix=tag+' Pagination';
for(let i=0;i<25;i++)await save('member',{name:prefix+' '+String(i).padStart(2,'0')});
const search=async (p_search:string,p_offset=0)=>{const r=await actors.member.rpc('search_production_contacts',{p_search,p_offset});assert.ifError(r.error);return r.data;};
const first=await search(prefix),next=await search(prefix,20);assert.equal(first.length,21);assert.equal(next.length,5);
assert.equal(new Set([...first.slice(0,20),...next].map((row:any)=>row.company.id)).size,25);
assert.deepEqual(await search(prefix),first);assert.equal((await search('Alex Contact')).filter((row:any)=>row.contact?.id===named.contact.id).length,1);
const wildcard=await search('%');assert.equal(wildcard.length,0);
for(const role of ['inactive'])denied(await actors[role].rpc('search_production_contacts',{p_search:''}));
denied(await anon.rpc('search_production_contacts',{p_search:''}));
const otherRead=await actors['other-member'].rpc('get_production_contact',{p_company_id:named.company.id,p_contact_id:named.contact.id});assert.ifError(otherRead.error); // Directory is intentionally shared with Production readers.
assert.equal((await actors['other-member'].from('app_users').select('user_id')).data?.length,1,'Directory access does not expand account visibility');
checks.push('Bounded stable pagination, company/person prefix search, literal wildcard escaping, inactive/anonymous lookup denial, shared authorized visibility without account leakage');
assert(productionValuesEqual('customer_contact_snapshot',{company_name:'A',contact_name:'B'},{contact_name:'B',company_name:'A'}));
assert(!productionValuesEqual('customer_contact_snapshot',{company_name:'A'},{company_name:'B'}));
// Permanent synthetic demonstration choices remain solely in the isolated local database.
const demo=await save('admin',{name:'Review Stoneworks',email:'office@review.example.invalid',phone:'555-0200'},{name:'Morgan Review',email:'morgan@review.example.invalid',phone:'555-0201'});
await save('member',demo.company,{name:'Taylor Review',email:'taylor@review.example.invalid'});
sql("notify pgrst,'reload schema';");
await mkdir('output/production-contacts',{recursive:true});await writeFile('output/production-contacts/database.json',JSON.stringify({checks,hostedAccess:false,localUrl:cfg.API_URL,migration:'20261014190000_production_contact_configuration.sql'},null,2)+'\n');
console.log(JSON.stringify({passed:checks.length,checks},null,2));
