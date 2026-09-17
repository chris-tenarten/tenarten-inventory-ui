import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const name = `tenops-po-line-material-${process.pid}`;
const image = 'postgres:17.6';
const migration = readFileSync('supabase/migrations/20260908_002_purchase_order_line_material_types.sql', 'utf8');
const inspection = readFileSync('supabase/inspection/20260908_002_purchase_order_line_material_types_verification.sql', 'utf8');
const orderUnitMigration = readFileSync('supabase/migrations/20260908_003_purchase_order_chip_order_unit.sql', 'utf8');
const orderUnitInspection = readFileSync('supabase/inspection/20260908_003_purchase_order_chip_order_unit_verification.sql', 'utf8');
const taxonomyMigration = readFileSync('supabase/migrations/20260917_004_purchase_order_material_taxonomy.sql', 'utf8');
const setup = String.raw`
do $$begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end$$;
create table public.purchase_orders(id uuid primary key, status text default 'draft', po_category text default 'chip', job_po_reference_type text, updated_at timestamptz default now());
create table public.purchase_order_lines(id uuid primary key default gen_random_uuid(), purchase_order_id uuid, line_number integer, line_category text default 'chip', status text default 'active', updated_at timestamptz default now());
create table public.chip_purchase_order_line_details(purchase_order_line_id uuid primary key, material_name_snapshot text, chip_size text not null, moisture_condition text, quantity_ordered numeric, order_unit text, unit_price numeric, updated_at timestamptz default now(), constraint chip_po_size_not_blank check(length(trim(chip_size))>0));
create table public.vendor_catalog_v2(id uuid primary key default gen_random_uuid(), material_type text, category text, updated_at timestamptz default now());
create function public.allocate_purchase_order_number(uuid) returns text language sql as $$select null::text$$;
create function public.save_chip_purchase_order_draft(p_order jsonb,p_lines jsonb,p_actor text) returns uuid language plpgsql as $$declare line jsonb;begin for line in select value from jsonb_array_elements(p_lines) loop if nullif(trim(line->>'material_name_snapshot'),'') is null or nullif(trim(line->>'chip_size'),'') is null then raise exception 'Every chip line needs material and chip size.'; end if; end loop; return gen_random_uuid();end$$;
create function public.save_purchasing_catalog_item(jsonb) returns uuid language sql as $$select gen_random_uuid()$$;
create function public.issue_purchase_order(uuid,text,timestamptz) returns void language plpgsql as $$declare selected_order public.purchase_orders%rowtype; header_snapshot jsonb;begin if exists(select 1 from public.purchase_order_lines lines join public.chip_purchase_order_line_details details on true where nullif(trim(details.material_name_snapshot), '') is null
        or nullif(trim(details.chip_size), '') is null
        or details.quantity_ordered <= 0) then raise exception 'invalid';end if;header_snapshot:=jsonb_build_object(
    'po_category', selected_order.po_category,
    'status', 'issued');perform jsonb_build_object(
      'line_kind', lines.line_category,
      'chip_size', details.chip_size,
      'quantity', details.quantity_ordered) from public.purchase_order_lines lines join public.chip_purchase_order_line_details details on true;end$$;
create function public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text) returns void language plpgsql as $$declare snapshot_line jsonb:='{}';begin if coalesce(snapshot_line ->> 'line_kind', '') <> 'chip' then raise exception 'invalid';end if;end$$;
`.replace(/\n/g, '\r\n');
const tests = String.raw`
do $$begin
  if pg_get_functiondef('public.save_chip_purchase_order_draft(jsonb,jsonb,text)'::regprocedure) not like '%Every material line requires a supported material classification.%' then raise exception 'Draft validation patch missing';end if;
  if pg_get_functiondef('public.issue_purchase_order(uuid,text,timestamptz)'::regprocedure) not like '%material_classification%' then raise exception 'Issuance classification patch missing';end if;
  if pg_get_functiondef('public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text)'::regprocedure) not like '%not in (''chip'',''resin'',''pigment'',''filler'',''other'')%' then raise exception 'Receival eligibility patch missing';end if;
  if pg_get_functiondef('public.save_chip_purchase_order_draft(jsonb,jsonb,text)'::regprocedure) not like '%Every Chip line requires Bag as its order unit.%' then raise exception 'Chip draft Bag guard missing';end if;
  if pg_get_functiondef('public.issue_purchase_order(uuid,text,timestamptz)'::regprocedure) not like '%lower(trim(details.order_unit)) not in (''bag'',''bags'')%' then raise exception 'Chip issuance Bag guard missing';end if;
  if pg_get_functiondef('public.save_chip_purchase_order_draft(jsonb,jsonb,text)'::regprocedure) not like '%''pigment'',''filler'',''other''%' then raise exception 'Expanded draft taxonomy missing';end if;
  if pg_get_functiondef('public.issue_purchase_order(uuid,text,timestamptz)'::regprocedure) not like '%''pigment'',''filler'',''other''%' then raise exception 'Expanded issuance taxonomy missing';end if;
  if pg_get_functiondef('public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text)'::regprocedure) not like '%''pigment'',''filler'',''other''%' then raise exception 'Expanded Receival taxonomy missing';end if;
  if not exists(select 1 from pg_constraint where conname='purchase_order_lines_material_type_check' and pg_get_constraintdef(oid) like '%pigment%filler%other%') then raise exception 'Expanded line constraint missing';end if;
end$$;
`;

function run(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  run(['run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=postgres', image]);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres']).status === 0) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    if (attempt === 59) throw new Error('Disposable PostgreSQL did not become ready.');
  }
  run(['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], setup + migration + inspection + orderUnitMigration + orderUnitInspection + taxonomyMigration + tests);
  console.log('Purchasing line-material migration checks passed.');
} finally {
  spawnSync('docker', ['stop', name]);
}
