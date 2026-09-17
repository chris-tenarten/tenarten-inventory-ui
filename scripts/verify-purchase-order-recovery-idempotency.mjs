import {readFileSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';

const name=`tenops-po-recovery-${process.pid}`;
const image='postgres:17.6';
const migration=readFileSync('supabase/migrations/20260917_005_purchase_order_recovery_idempotency.sql','utf8');
const setup=String.raw`
create schema extensions;
create extension pgcrypto with schema extensions;
do $$begin
  if not exists(select 1 from pg_roles where rolname='anon')then create role anon;end if;
  if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated;end if;
  if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role;end if;
end$$;
create table public.purchase_orders(
  id uuid primary key default gen_random_uuid(),po_number text,status text not null default 'draft',
  updated_at timestamptz not null default now()
);
create function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text)
returns uuid language plpgsql security definer as $$
declare selected_id uuid;
begin
  insert into public.purchase_orders default values returning id into selected_id;
  return selected_id;
end$$;
grant execute on function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text) to authenticated,service_role;
grant select on public.purchase_orders to authenticated;
`;
const common=String.raw`'{"vendor":"DCS"}'::jsonb,'[{"line_number":1,"material_type":"pigment"}]'::jsonb,'Anthony','RECOVER_EVIDENCE_BACKED_UNNUMBERED_DRAFT','anthony-hermes-dcs-2026-09-15'`;
const tests=String.raw`
set role authenticated;
create temp table recovery_results(id uuid);
insert into recovery_results select public.recover_purchase_order_draft_v2(${common});
insert into recovery_results select public.recover_purchase_order_draft_v2(${common});
do $$begin
  if (select count(distinct id) from recovery_results)<>1 then raise exception 'Exact retry created another Draft';end if;
  if (select count(*) from public.purchase_orders where recovery_key='anthony-hermes-dcs-2026-09-15')<>1 then raise exception 'Recovery identity is not unique';end if;
  if has_function_privilege('authenticated','public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text)','execute') then raise exception 'Unsafe recovery overload remains executable';end if;
  begin
    perform public.recover_purchase_order_draft_v2('{"vendor":"different"}'::jsonb,'[]'::jsonb,'Anthony','RECOVER_EVIDENCE_BACKED_UNNUMBERED_DRAFT','anthony-hermes-dcs-2026-09-15');
    raise exception 'Conflicting recovery payload was accepted';
  exception when unique_violation then null;end;
end$$;
reset role;
insert into public.purchase_orders default values;
do $$begin
  if exists(select 1 from public.purchase_orders where recovery_key is null and recovery_payload_hash is not null) then raise exception 'Ordinary Draft recovery identity is invalid';end if;
end$$;
`;
function run(args,input){const result=spawnSync('docker',args,{input,encoding:'utf8'});if(result.status!==0)throw new Error(`${result.stdout}\n${result.stderr}`);return result.stdout;}
const concurrent=(sql)=>new Promise((resolve,reject)=>{const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',part=>out+=part);child.stderr.on('data',part=>err+=part);child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(`${out}\n${err}`)));child.stdin.end(sql);});
try{
  run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres',image]);
  for(let attempt=0;attempt<40;attempt++){if(spawnSync('docker',['exec',name,'pg_isready','-U','postgres']).status===0){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);break;}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);if(attempt===39)throw new Error('Disposable PostgreSQL did not become ready.');}
  run(['exec','-i',name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],setup+migration+tests);
  const raceKey='concurrent-recovery-test';
  const sql=`set role authenticated;select public.recover_purchase_order_draft_v2(${common.replace('anthony-hermes-dcs-2026-09-15',raceKey)});`;
  const ids=await Promise.all([concurrent(sql),concurrent(sql)]);
  if(ids[0]!==ids[1])throw new Error(`Concurrent retry returned different Drafts: ${ids.join(', ')}`);
  const count=run(['exec','-i',name,'psql','-U','postgres','-d','postgres','-At'],`select count(*) from public.purchase_orders where recovery_key='${raceKey}';`).trim();
  if(count!=='1')throw new Error(`Concurrent recovery created ${count} Drafts.`);
  console.log('Purchase Order recovery idempotency checks passed.');
}finally{spawnSync('docker',['stop',name]);}
