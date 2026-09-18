import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(path,'utf8');
const save = read('supabase/migrations/20260908_002_purchase_order_line_material_types.sql').match(/create or replace function public.save_chip_purchase_order_draft_v2[\s\S]*?end;\$function\$;/)[0];
const capture = read('supabase/migrations/20260723_005_purchase_order_pdf_v2.sql').match(/create or replace function public.capture_purchase_order_pdf_snapshot_fields\(\)[\s\S]*?\$\$;/)[0];
const migration = read('supabase/migrations/20260918_002_purchase_order_pdf_text_size.sql');
const setup = `
create extension pgcrypto;
create role authenticated;
create table purchase_orders(id uuid primary key, status text default 'draft', job_po_reference_type text, document_template text default 'tenops', updated_at timestamptz);
create table purchase_order_lines(purchase_order_id uuid,line_number int,material_type text,updated_at timestamptz,id uuid);
create table chip_purchase_order_line_details(purchase_order_line_id uuid,resin_color text,component_type text,moisture_condition text,updated_at timestamptz);
create table jobs(id uuid,customer text);
create table purchase_order_issuances(id uuid default gen_random_uuid(),purchase_order_id uuid,order_snapshot jsonb,lines_snapshot jsonb,snapshot_hash text);
create function save_chip_purchase_order_draft(p_order jsonb,p_lines jsonb,p_actor text) returns uuid language plpgsql as $$
declare target uuid:=coalesce((p_order->>'id')::uuid,gen_random_uuid()); begin
 if p_actor <> 'Allowed actor' then raise exception 'Unauthorized'; end if;
 insert into purchase_orders(id) values(target) on conflict(id) do nothing; return target; end;$$;
create function allocate_purchase_order_number(uuid) returns text language sql as $$select 'PO-TEST'::text$$;
${save}
${capture}
create trigger capture before insert on purchase_order_issuances for each row execute function capture_purchase_order_pdf_snapshot_fields();
revoke all on function save_chip_purchase_order_draft_v2(jsonb,jsonb,text) from public;
grant execute on function save_chip_purchase_order_draft_v2(jsonb,jsonb,text) to authenticated;
insert into purchase_orders(id,status) values('00000000-0000-0000-0000-000000000001','issued');
insert into purchase_order_issuances(purchase_order_id,order_snapshot,lines_snapshot) values('00000000-0000-0000-0000-000000000001','{}','[]');
create table historical as select * from purchase_order_issuances;
`;
const tests = `
do $$declare target uuid; preset text; snap jsonb; hash text; begin
 if exists(select 1 from purchase_orders where pdf_text_size is not null) then raise exception 'Historical orders backfilled'; end if;
 if exists((select * from historical) except (select * from purchase_order_issuances)) then raise exception 'Historical snapshot changed'; end if;
 foreach preset in array array['compact','standard','large'] loop
   target:=save_chip_purchase_order_draft_v2(jsonb_build_object('pdf_text_size',preset),'[]','Allowed actor');
   if (select pdf_text_size from purchase_orders where id=target) <> preset then raise exception 'Preference did not persist'; end if;
   perform save_chip_purchase_order_draft_v2(jsonb_build_object('id',target),'[]','Allowed actor');
   if (select pdf_text_size from purchase_orders where id=target) <> preset then raise exception 'Legacy client reset preference'; end if;
   insert into purchase_order_issuances(purchase_order_id,order_snapshot,lines_snapshot) values(target,'{}','[]') returning order_snapshot,snapshot_hash into snap,hash;
   if snap->>'pdf_text_size' <> preset then raise exception 'Snapshot lost preset'; end if;
   if hash <> encode(digest(convert_to(snap::text || E'\\n' || '[]','UTF8'),'sha256'),'hex') then raise exception 'Preset not in snapshot hash'; end if;
   perform save_chip_purchase_order_draft_v2(jsonb_build_object('id',target,'pdf_text_size','standard'),'[]','Allowed actor');
   if (select order_snapshot from purchase_order_issuances where purchase_order_id=target) <> snap then raise exception 'Draft changed issuance'; end if;
 end loop;
 target:=save_chip_purchase_order_draft_v2('{}','[]','Allowed actor');
 insert into purchase_order_issuances(purchase_order_id,order_snapshot,lines_snapshot) values(target,'{}','[]') returning order_snapshot into snap;
 if snap->>'pdf_text_size' <> 'standard' then raise exception 'Legacy default incorrect'; end if;
 begin
   perform save_chip_purchase_order_draft_v2('{"pdf_text_size":"huge"}','[]','Allowed actor');
   raise exception 'Invalid preset accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform save_chip_purchase_order_draft_v2('{"pdf_text_size":null}','[]','Allowed actor');
   raise exception 'Null preset accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform save_chip_purchase_order_draft_v2('{"pdf_text_size":"large"}','[]','Denied actor');
   raise exception 'Authorization bypass';
 exception when others then if sqlerrm <> 'Unauthorized' then raise; end if; end;
 begin
   perform save_chip_purchase_order_draft_v2('{"id":"00000000-0000-0000-0000-000000000001","pdf_text_size":"large"}','[]','Allowed actor');
   raise exception 'Issued order edited';
 exception when others then if sqlerrm <> 'Only draft Purchase Orders can set a Production PO reference.' then raise; end if; end;
 if not has_function_privilege('authenticated','save_chip_purchase_order_draft_v2(jsonb,jsonb,text)','execute') then raise exception 'Grant lost'; end if;
end$$;
`;
const name=`tenops-po-text-size-${process.pid}`;
function run(args,input) { const r=spawnSync('docker',args,{input,encoding:'utf8'}); assert.equal(r.status,0,`${r.stdout}\n${r.stderr}`);return r.stdout; }
try {
 run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres','postgres:17.6']);
 for(let i=0;i<60;i++){if(spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}
 run(['exec','-i',name,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1'],setup+migration+tests);
 console.log('PO text-size persistence/snapshot migration passed in disposable PostgreSQL. Core save authorization is a fixture; hosted RBAC was not tested.');
} finally { run(['stop',name]); }
