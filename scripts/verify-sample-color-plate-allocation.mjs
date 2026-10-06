import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawn} from 'node:child_process';
import {startBlendDatabase,sql,asUser,literal,json} from './support/production-blend-database.mjs';import {docker} from './support/sample-batch-database.mjs';
const db=`tenops-numbering-${process.pid}`;const migration='20261006190000_sample_color_plate_allocation.sql';
try{
 startBlendDatabase(db);for(const f of ['20261006120000_sample_audience_pdf_version.sql','20261006160000_sample_color_plate_validation.sql'])sql(db,readFileSync('supabase/migrations/'+f,'utf8'));
 const call=q=>sql(db,asUser('select '+q));const seed=call('create_sample()');const state=JSON.parse(call(`formulation_state from samples where id=${literal(seed)}`));
 sql(db,`update samples set color_plate_number='T26-267-A',more_notes='Historical instruction' where id=${literal(seed)}`);const before=call(`to_jsonb(s) from samples s where id=${literal(seed)}`);
 sql(db,readFileSync('supabase/migrations/'+migration,'utf8'));assert.equal(call(`to_jsonb(s) from samples s where id=${literal(seed)}`),before);
 const year=Number(sql(db,"select extract(year from clock_timestamp() at time zone 'UTC')")),prefix=`T${String(year).slice(-2)}-`;
 const rows=[{color:'White',percentage:'100',component_role:'aggregate',quantity_provenance:'calculated',calculation_basis:'target_total',unit:'oz'},...['filler','resin','hardener'].map(component_role=>({color:component_role,component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz'}))];
 const payload={id:'',prepared_by:'Local allocator check',requested_date:'2020-01-01',formulation_state:state};
 const expression=(auto=true,plate='ignored suggestion')=>`create_sample_with_formulation(${json({...payload,color_plate_number:plate})},${json(rows)},'Local allocator check',${auto})`;
 const create=(auto,plate)=>JSON.parse(call(expression(auto,plate)));
 for(let i=0;i<3;i++)assert.equal(call('suggest_sample_color_plate_number()'),prefix+'900-A');assert.equal(sql(db,'select count(*) from sample_color_plate_counters'),'0');
 assert.throws(()=>call(`create_sample_with_formulation(${json({...payload,requested_date:'not-a-date'})},'[]','Invalid',true)`));assert.equal(sql(db,'select count(*) from sample_color_plate_counters'),'0');
 const first=create(true);assert.equal(first.color_plate_number,prefix+'900-A');assert.equal(call('suggest_sample_color_plate_number()'),prefix+'901-A');const second=create(true);assert.equal(second.color_plate_number,prefix+'901-A');
 const manual=create(false,'T26-500-A');assert.equal(manual.color_plate_number,'T26-500-A');assert.equal(call('suggest_sample_color_plate_number()'),prefix+'902-A');
 create(false,prefix+'902B');assert.equal(call('suggest_sample_color_plate_number()'),prefix+'903-A');
 const parallel=()=>new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',db,'psql','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',c=>c?reject(Error(err)):resolve(JSON.parse(out.trim().split('\n').at(-1))));p.stdin.end(asUser('select '+expression()+';'));});
 const concurrent=await Promise.all([parallel(),parallel()]);assert.deepEqual(concurrent.map(r=>r.color_plate_number).sort(),[prefix+'903-A',prefix+'904-A']);
 call(`admin_permanently_delete_sample_draft(${literal(concurrent.find(r=>r.color_plate_number===prefix+'904-A').id)},'PERMANENTLY_DELETE_SAMPLE_DRAFT_AS_ADMIN')`);assert.equal(call('suggest_sample_color_plate_number()'),prefix+'905-A');
 // Historical captures and pre-existing identities remain unchanged by unrelated allocations.
 assert.equal(call(`to_jsonb(s) from samples s where id=${literal(seed)}`),before);const doc=call(`issue_sample_form(${literal(first.id)})`);assert.equal(call(`issued_snapshot->>'color_plate_number' from sample_issued_documents where id=${literal(doc)}`),first.color_plate_number);
 assert.throws(()=>call(`create_sample_with_formulation(${json({...payload,id:seed})},${json(rows)},'Existing',true)`),/existing identity/);
 assert.throws(()=>sql(db,"set role authenticated; select suggest_sample_color_plate_number();"),/denied/);
 assert.throws(()=>sql(db,`set role authenticated; select ${expression()};`),/denied/);
 assert.equal(sql(db,"select has_table_privilege('authenticated','public.sample_color_plate_counters','UPDATE')"),'f');assert.equal(sql(db,"select has_function_privilege('authenticated','public.sample_color_plate_next_sequence(integer)','EXECUTE')"),'f');assert.throws(()=>sql(db,"set role anon; select suggest_sample_color_plate_number();"),/permission denied/);
 // Clock substitution is confined to this disposable transaction; no caller-controlled year exists in the production RPC.
 const nextYear=year+1;const def=sql(db,"select pg_get_functiondef('public.create_sample_with_formulation(jsonb,jsonb,text,boolean)'::regprocedure)");const mocked=def.replace("extract(year from clock_timestamp() at time zone 'UTC')",String(nextYear));
 const rollover=sql(db,asUser(`begin;${mocked};select ${expression()};rollback;`)).split('\n').find(line=>line.startsWith('{'));assert.equal(JSON.parse(rollover).color_plate_number,`T${String(nextYear).slice(-2)}-900-A`);
 // No three-digit ceiling: imported/overridden 999 reserves that family and next is 1000.
 create(false,prefix+'999-A');assert.equal(create(true).color_plate_number,prefix+'1000-A');
 console.log('PASS suggestion/no consumption; 900/901 saves; authoritative year despite backdate; failed-save rollback; manual preservation; occupied variant/punctuation skip; concurrent 903/904; deleted 904 not reused; next-year 900; 1000 continuation; unchanged historical row; captured document identity; private counter/allocator grants.');
}finally{docker(['stop',db]);}
