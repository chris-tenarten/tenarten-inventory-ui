/** Tier 3 focused local assessment/import. Refuses hosted endpoints. Existing Jobs/RLS untouched. */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { localConfig,sql } from './support/production-contact-local.mjs';
const cfg=localConfig(),checks=[];
const migration='20261014230000_approved_historical_customer_names.sql';
const manifestPath='docs/project-memory/customer-import-approved-2026-10-14.json';
const manifestText=await readFile(manifestPath,'utf8'),manifest=JSON.parse(manifestText);
assert.equal(manifest.names.length,20);assert.equal(new Set(manifest.names.map(n=>n.toLowerCase())).size,20);
const expectedNames=[...manifest.names].sort();
const beforeJobs=sql("select coalesce(jsonb_agg(to_jsonb(j) order by id),'[]') from public.jobs j;");
const beforeJobsPolicies=sql("select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='jobs';");
if(sql("select to_regprocedure('public.import_approved_historical_customers_20261014()') is not null;")!=='t'){
 sql(await readFile('supabase/migrations/'+migration,'utf8'));
}
// New disposable assessment objects, not replacements for existing Production tables.
if(sql("select to_regclass('public.contact_access_legacy_fixture') is not null;")!=='t')sql(`
 create table public.contact_access_legacy_fixture(id uuid primary key,customer text,contact_snapshot jsonb);
 alter table public.contact_access_legacy_fixture enable row level security;
 grant select on public.contact_access_legacy_fixture to authenticated;
 create policy broad_authenticated_read on public.contact_access_legacy_fixture for select to authenticated using(true);
 create table public.contact_access_base_fixture(id uuid primary key,customer text);
 alter table public.contact_access_base_fixture enable row level security;
 grant select on public.contact_access_base_fixture to authenticated;
 create policy broad_authenticated_read on public.contact_access_base_fixture for select to authenticated using(true);
 create table public.contact_access_snapshot_fixture(job_id uuid primary key references public.contact_access_base_fixture(id),snapshot jsonb not null);
 alter table public.contact_access_snapshot_fixture enable row level security;
 revoke all on public.contact_access_snapshot_fixture from anon,authenticated;
 grant select,insert,update on public.contact_access_snapshot_fixture to authenticated;
 create policy operational_read on public.contact_access_snapshot_fixture for select to authenticated using(public.has_app_capability('readOperationalData'));
 create policy project_contact_insert on public.contact_access_snapshot_fixture for insert to authenticated with check(public.can_manage_production_contacts(false));
 create policy project_contact_update on public.contact_access_snapshot_fixture for update to authenticated using(public.can_manage_production_contacts(false)) with check(public.can_manage_production_contacts(false));
 create view public.contact_access_join_fixture with(security_invoker=true) as select j.id,j.customer,s.snapshot from public.contact_access_base_fixture j left join public.contact_access_snapshot_fixture s on s.job_id=j.id;
 grant select on public.contact_access_join_fixture to authenticated;
`);
const id=randomUUID();
sql(`insert into public.contact_access_legacy_fixture values('${id}','Synthetic customer','{"email":"private@example.invalid"}');insert into public.contact_access_base_fixture values('${id}','Synthetic customer');insert into public.contact_access_snapshot_fixture values('${id}','{"email":"private@example.invalid"}');notify pgrst,'reload schema';`);
const accounts=JSON.parse(await readFile('.tmp-contact-review/accounts.json','utf8')),actors={},sessions={};
for(const a of accounts){const c=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const login=await c.auth.signInWithPassword({email:a.email,password:a.password});assert.ifError(login.error);const key=a.email.split('@')[0].slice('contact-'.length);actors[key]=c;sessions[key]=login.data.session;}
const anon=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false}});
const denied=r=>{assert(r.error,'Expected denial');assert.equal(r.error.code,'42501',JSON.stringify(r.error));};
assert.equal(sessions.member.user.role,'authenticated');assert.equal(sessions.inactive.user.role,'authenticated');
// A: revoking a column grant does not override an existing table-level SELECT.
sql('grant select on public.contact_access_legacy_fixture to authenticated;revoke select(contact_snapshot) on public.contact_access_legacy_fixture from authenticated;');
let r=await actors.inactive.from('contact_access_legacy_fixture').select('contact_snapshot').eq('id',id).single();assert.ifError(r.error);assert.equal(r.data.contact_snapshot.email,'private@example.invalid');
sql('revoke select on public.contact_access_legacy_fixture from authenticated;grant select(id,customer) on public.contact_access_legacy_fixture to authenticated;');
denied(await actors.member.from('contact_access_legacy_fixture').select('contact_snapshot').eq('id',id));
sql('grant select(contact_snapshot) on public.contact_access_legacy_fixture to authenticated;');
r=await actors.inactive.from('contact_access_legacy_fixture').select('contact_snapshot').eq('id',id).single();assert.ifError(r.error);
checks.push('A reproduced: column revocation cannot override table SELECT; column grant to authenticated admits inactive sessions too');
// B/C: broad existing base reads remain; separate operational-read RLS protects details even through a join.
r=await actors.inactive.from('contact_access_base_fixture').select('*').eq('id',id).single();assert.ifError(r.error);assert.equal(r.data.customer,'Synthetic customer');
r=await actors.inactive.from('contact_access_snapshot_fixture').select('*').eq('job_id',id);assert.ifError(r.error);assert.deepEqual(r.data,[]);
r=await actors.inactive.from('contact_access_join_fixture').select('*').eq('id',id).single();assert.ifError(r.error);assert.equal(r.data.snapshot,null);
for(const role of ['member','lead','admin','reader','guest','developer']){r=await actors[role].from('contact_access_snapshot_fixture').select('snapshot').eq('job_id',id).single();assert.ifError(r.error);assert.equal(r.data.snapshot.email,'private@example.invalid');}
denied(await anon.from('contact_access_snapshot_fixture').select('*'));
const readOnlyWrite=await actors.reader.from('contact_access_snapshot_fixture').update({snapshot:{email:'forbidden@example.invalid'}}).eq('job_id',id).select();assert(readOnlyWrite.error||readOnlyWrite.data.length===0);
assert.ifError((await actors.member.from('contact_access_snapshot_fixture').update({snapshot:{email:'member@example.invalid'}}).eq('job_id',id)).error);
checks.push('B/C direct API: inactive retains base Job reads but sees zero protected rows/null joined detail; active operational readers including read-only can read; anonymous/read-only writes denied');
// Existing fixture companies are explicit synthetic conflict/preservation cases. Never change their values.
for(const [name,archived,notes] of [[' Atlantic Exterior Wall Systems ',false,'Import fixture: preserve'],['DePaoli Mosaic',true,'Import fixture: archived'],['LX Granite',false,'Import fixture: duplicate A'],[' lx granite ',false,'Import fixture: duplicate B']]){
 const exists=sql(`select count(*) from public.production_companies where notes='${notes}';`);
 if(exists==='0')sql(`insert into public.production_companies(name,email,phone,notes,archived_at) values('${name}','preserve@example.invalid','555-EXISTING','${notes}',${archived?'clock_timestamp()':'null'});`);
}
const beforeCompanies=JSON.parse(sql("select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.production_companies c;"));
const beforeContacts=sql("select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.production_contacts c;");
const key=n=>n.trim().toLowerCase();
// Clean-directory copy of the exact function body: only table/function identifiers differ.
if(sql("select to_regclass('public.contact_import_empty_fixture') is not null;")!=='t'){
 sql('create table public.contact_import_empty_fixture (like public.production_companies including all);alter table public.contact_import_empty_fixture enable row level security;revoke all on public.contact_import_empty_fixture from anon,authenticated;');
 const fixtureMigration=(await readFile('supabase/migrations/'+migration,'utf8')).replaceAll('public.production_companies','public.contact_import_empty_fixture').replaceAll('import_approved_historical_customers_20261014','import_approved_customers_empty_fixture');
 sql(fixtureMigration);sql("notify pgrst,'reload schema';");
}
async function readyRpc(name){for(let attempt=0;attempt<20;attempt++){const result=await actors.admin.rpc(name);if(result.error?.code!=='PGRST202')return result;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Local PostgREST schema cache did not refresh');}
let clean=await readyRpc('import_approved_customers_empty_fixture');assert.ifError(clean.error);assert.deepEqual(clean.data.map(r=>r.customer_name).sort(),expectedNames);assert(clean.data.every(r=>r.status==='inserted'||r.status==='already_configured'));
assert.equal(sql('select count(*) from public.contact_import_empty_fixture;'),'20');
const cleanRerun=await actors.admin.rpc('import_approved_customers_empty_fixture');assert.ifError(cleanRerun.error);assert(cleanRerun.data.every(r=>r.status==='already_configured'));
assert.equal(sql("select count(*) from public.contact_import_empty_fixture where phone<>'' or email<>'' or mailing_address<>'' or notes<>'' or default_contact_id is not null;"),'0');
checks.push('Clean isolated directory: all 20 approved names present, rerun inserts zero, all optional contact data empty');
const expected=new Map(manifest.names.map(name=>{const matches=beforeCompanies.filter(c=>key(c.name)===key(name));return [name,matches.length>1?'ambiguous_existing':matches.length===1?(matches[0].archived_at?'archived_excluded':'already_configured'):'inserted'];}));
for(const role of ['member','lead','guest','developer','reader','inactive'])denied(await actors[role].rpc('import_approved_historical_customers_20261014'));
denied(await anon.rpc('import_approved_historical_customers_20261014'));
const importNames=async()=>{const result=await actors.admin.rpc('import_approved_historical_customers_20261014');assert.ifError(result.error);assert.deepEqual(result.data.map(x=>x.customer_name).sort(),expectedNames);return result.data;};
const runs=await Promise.all([importNames(),importNames()]);
for(const name of manifest.names){const statuses=runs.map(rows=>rows.find(r=>r.customer_name===name).status);const wanted=expected.get(name);if(wanted==='inserted')assert.deepEqual(statuses.sort(),['already_configured','inserted']);else assert(statuses.every(s=>s===wanted),name);}
const rerun=await importNames();assert(!rerun.some(r=>r.status==='inserted'));
const afterCompanies=JSON.parse(sql("select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.production_companies c;"));
for(const c of beforeCompanies)assert.deepEqual(afterCompanies.find(row=>row.id===c.id),c,'Existing company unchanged');
const added=afterCompanies.filter(c=>!beforeCompanies.some(old=>old.id===c.id));
for(const c of added){assert(manifest.names.includes(c.name));for(const field of ['phone','email','mailing_address','notes'])assert.equal(c[field],'');assert.equal(c.default_contact_id,null);assert.equal(c.archived_at,null);}
assert.equal(sql("select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.production_contacts c;"),beforeContacts);
for(const pair of manifest.keepSeparate){const a=afterCompanies.filter(c=>key(c.name)===key(pair[0])),b=afterCompanies.filter(c=>key(c.name)===key(pair[1]));assert(a.length&&b.length);assert(!a.some(x=>b.some(y=>x.id===y.id)));}
for(const name of manifest.excluded)assert.equal(afterCompanies.filter(c=>key(c.name)===key(name)).length,beforeCompanies.filter(c=>key(c.name)===key(name)).length);
assert.equal(sql("select coalesce(jsonb_agg(to_jsonb(j) order by id),'[]') from public.jobs j;"),beforeJobs);
assert.equal(sql("select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='jobs';"),beforeJobsPolicies);
checks.push('Exact 20-name Admin-only import: concurrent calls serialize, rerun inserts zero; case/whitespace matches, archived records and ambiguity handled without overwrite');
checks.push('All existing companies/contacts/Jobs and Jobs RLS unchanged; added rows have empty contact fields; exclusions not imported and similar names remain separate');
const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const external=[];
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(['localhost','127.0.0.1'].includes(u.hostname))return route.continue();external.push(u.origin);return route.abort();});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},{session:sessions.member});
 await page.goto('http://localhost:3001/');await page.getByRole('button',{name:'New Job',exact:true}).click();await page.getByRole('button',{name:/Create Blank Job/}).click();const d=page.getByRole('dialog',{name:'Create Blank Job',exact:true});await d.getByRole('combobox',{name:'Customer',exact:true}).click();await d.getByLabel('Search customers',{exact:true}).fill('United Enterprises, Inc');await d.getByRole('group',{name:'Configured Customers',exact:true}).getByRole('option',{name:'United Enterprises, Inc',exact:true}).waitFor();await d.screenshot({path:'output/customer-import/import-dropdown.png'});assert.deepEqual(external,[]);
}finally{await browser.close();}
checks.push('Actual localhost:3001 accepted customer dropdown shows an imported customer; no Job created or changed for browser validation');
const result={checks,manifestSha256:createHash('sha256').update(manifestText).digest('hex'),migration,cleanDirectory:{count:20,firstInserted:clean.data.filter(r=>r.status==='inserted').length,rerunInserted:0},firstConcurrentRuns:runs.map(rows=>rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})),rerun:rerun.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),inserted:added.length,existingJobsAndRlsUnchanged:true,assessmentOnly:true,protectedSnapshotCandidateIntegrated:false,hostedWrites:false};
await writeFile('output/customer-import/access-and-import.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
