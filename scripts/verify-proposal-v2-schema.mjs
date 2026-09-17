import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const migration = readFileSync('supabase/migrations/20260908_004_proposal_generator_v2.sql','utf8');
const image = 'public.ecr.aws/supabase/postgres:17.6.1.143';
const container = `tenops-proposal-v2-${process.pid}`;
const admin = '00000000-0000-0000-0000-000000000001';
const estimator = '00000000-0000-0000-0000-000000000002';
const inactive = '00000000-0000-0000-0000-000000000003';
const nonAllowlisted = '00000000-0000-0000-0000-000000000004';
const issuedLegacy = '10000000-0000-0000-0000-000000000001';
const draftLegacy = '10000000-0000-0000-0000-000000000002';
const draftLegacyUninitialized = '10000000-0000-0000-0000-000000000003';

assert.doesNotMatch(migration,/update public\.proposals[\s\S]*where status='issued'/i);
assert.match(migration,/revoke insert,update,delete on public\.proposals,public\.proposal_lines from authenticated/);
assert.match(migration,/current_setting\('tenops\.admin_proposal_delete',true\)/);
assert.match(migration,/alter table public\.proposal_pdf_documents\s+alter column document_version set default 'proposal-pdf-v2'/);
assert.match(migration,/perform public\.ensure_proposal_estimate\(p_proposal_id\);[\s\S]*select \* into strict estimate/);
assert.match(migration,/insert into public\.proposal_pdf_documents\(proposal_id,document_version,status\)[\s\S]*'proposal-pdf-v2'/);
assert.doesNotMatch(migration,/update\s+public\.proposal_pdf_documents\s+set\s+document_version/i);

const setup = String.raw`
create extension if not exists pg_graphql;
alter event trigger graphql_watch_ddl disable;
alter event trigger graphql_watch_drop disable;
do $$begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end$$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.app_users(
  user_id uuid primary key,display_name text not null,role text not null,is_active boolean not null
);
create table public.jobs(
  id uuid primary key,job_number text,name text,customer text,estimate_number text,
  requested_delivery_date date,color_plate_number text
);
create table public.job_attachments(id uuid primary key);
create table public.test_ids(name text primary key,id uuid not null);
create table public.proposal_access_users(
  user_id uuid primary key references public.app_users(user_id),
  granted_at timestamptz default now(),granted_by_user_id uuid references public.app_users(user_id)
);
create function public.has_proposal_access() returns boolean language sql stable security definer as $$
  select exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin')
    or exists(select 1 from public.proposal_access_users a join public.app_users u using(user_id) where a.user_id=auth.uid() and u.is_active)
$$;
create function public.has_app_capability(text) returns boolean language sql stable security definer as $$
  select exists(select 1 from public.app_users where user_id=auth.uid() and is_active)
$$;
create function public.tenops_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=clock_timestamp();return new;end$$;

create table public.proposals(
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete restrict,
  lineage_id uuid not null,
  prior_proposal_id uuid references public.proposals(id) on delete restrict,
  estimate_base text not null,
  version_major integer not null default 1,
  version_minor integer not null default 0,
  estimate_number text not null unique,
  status text not null default 'draft' check(status in('draft','issued')),
  proposal_date date not null default current_date,
  customer_name text not null default '',customer_address text not null default '',customer_contact text not null default '',
  project_name text not null default '',project_number text not null default '',project_location text not null default '',
  side_mark text not null default '',sales_rep text not null default '',terms text not null default '50% Dep / Net 30',
  valid_days integer not null default 30,requested_delivery text not null default '',fob text not null default 'Carrollton, TX',
  destination_zip text not null default '',tax_county text not null default 'Dallas County',
  submitted_by_name text not null default 'Anthony Iorio',submitted_by_phone text not null default '',submitted_by_email text not null default '',
  notes text not null default '',disclaimer_snapshot text not null default '',formula_snapshot text not null default '',
  proposal_field_sources jsonb not null default '{}',tax_enabled boolean not null default false,tax_rate numeric,
  subtotal numeric(14,2) not null default 0,tax numeric(14,2) not null default 0,total numeric(14,2) not null default 0,
  freight_estimate numeric(14,2),preliminary_drawings_attached boolean not null default false,
  crating_included boolean not null default false,cut_tickets_included boolean not null default false,
  field_dimensioning_excluded boolean not null default false,
  issued_snapshot jsonb,issued_at timestamptz,issued_by_user_id uuid references public.app_users(user_id),
  created_by_user_id uuid not null references public.app_users(user_id),created_by_name text not null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(lineage_id,version_major,version_minor)
);
create table public.proposal_lines(
  id uuid primary key default gen_random_uuid(),proposal_id uuid not null references public.proposals(id) on delete cascade,
  line_type text not null default 'product' check(line_type in('product','charge','informational','included')),
  item_number text not null default '',description text not null default '',ref text not null default '',color_plate text not null default '',
  quantity numeric(14,4),unit text not null default '',length text not null default '',width text not null default '',
  height_thickness text not null default '',cft text not null default '',lf text not null default '',estimated_weight text not null default '',
  rate numeric(14,2),total numeric(14,2) not null default 0,source_metadata jsonb not null default '{}',display_order integer not null default 0,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.proposal_documents(
  id uuid primary key default gen_random_uuid(),proposal_id uuid not null references public.proposals(id) on delete cascade,
  job_attachment_id uuid not null references public.job_attachments(id),document_role text not null default 'shop_drawing',
  extraction_snapshot jsonb not null default '{}',created_by_user_id uuid not null references public.app_users(user_id),created_at timestamptz default now()
);
create table public.proposal_pdf_documents(
  id uuid primary key default gen_random_uuid(),proposal_id uuid not null unique references public.proposals(id) on delete restrict,
  storage_bucket text not null default 'proposal-documents',storage_path text not null default '',snapshot_hash text not null default '',
  document_version text not null default 'proposal-pdf-v1',status text not null default 'pending',generated_at timestamptz,last_error text,
  attempt_count integer not null default 0,created_at timestamptz default now(),updated_at timestamptz default now()
);
create function public.proposal_issued_immutable() returns trigger language plpgsql as $$
begin
  if old.status='issued' and not(
    tg_op='DELETE' and current_setting('tenops.admin_proposal_delete',true)=old.id::text
    and exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin')
  ) then raise exception 'Issued immutable' using errcode='55000';end if;
  return case when tg_op='DELETE' then old else new end;
end$$;
create trigger proposal_issued_immutable before update or delete on public.proposals for each row execute function public.proposal_issued_immutable();
create function public.proposal_line_issued_immutable() returns trigger language plpgsql as $$
begin
  if exists(select 1 from public.proposals where id=old.proposal_id and status='issued') and not(
    tg_op='DELETE' and current_setting('tenops.admin_proposal_delete',true)=old.proposal_id::text
    and exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin')
  ) then raise exception 'Issued lines immutable' using errcode='55000';end if;
  return case when tg_op='DELETE' then old else new end;
end$$;
create trigger proposal_line_issued_immutable before update or delete on public.proposal_lines for each row execute function public.proposal_line_issued_immutable();
create function public.proposal_clarification_revision_defaults() returns trigger language plpgsql as $$
begin
  if new.prior_proposal_id is not null then
    select freight_estimate,preliminary_drawings_attached,crating_included,cut_tickets_included,field_dimensioning_excluded
    into new.freight_estimate,new.preliminary_drawings_attached,new.crating_included,new.cut_tickets_included,new.field_dimensioning_excluded
    from public.proposals where id=new.prior_proposal_id;
  end if;return new;
end$$;
create trigger proposal_clarification_revision_defaults before insert on public.proposals for each row execute function public.proposal_clarification_revision_defaults();
create function public.save_proposal_clarifications(p_proposal jsonb) returns void language plpgsql security definer as $$
declare pid uuid:=(p_proposal->>'id')::uuid;
begin
  if not public.has_proposal_access() then raise exception 'denied' using errcode='42501';end if;
  if not exists(select 1 from public.proposals where id=pid and status='draft') then raise exception 'draft required' using errcode='55000';end if;
  update public.proposals set
    freight_estimate=nullif(p_proposal->>'freight_estimate','')::numeric,
    preliminary_drawings_attached=coalesce((p_proposal->>'preliminary_drawings_attached')::boolean,false),
    crating_included=coalesce((p_proposal->>'crating_included')::boolean,false),
    cut_tickets_included=coalesce((p_proposal->>'cut_tickets_included')::boolean,false),
    field_dimensioning_excluded=coalesce((p_proposal->>'field_dimensioning_excluded')::boolean,false)
  where id=pid;
end$$;

create function public.create_proposal() returns uuid language plpgsql security definer as $$
declare created uuid:=gen_random_uuid();base text:='Q26-0908';major integer;
begin
  if not public.has_proposal_access() then raise exception 'denied' using errcode='42501';end if;
  select coalesce(max(version_major),0)+1 into major from public.proposals where estimate_base=base;
  insert into public.proposals(id,lineage_id,estimate_base,version_major,estimate_number,created_by_user_id,created_by_name)
  values(created,created,base,major,base||'-'||major||'.0',auth.uid(),(select display_name from public.app_users where user_id=auth.uid()));
  insert into public.proposal_lines(proposal_id,item_number)values(created,'1');
  return created;
end$$;
create function public.admin_delete_issued_proposal(p_proposal_id uuid) returns void language plpgsql security definer as $$
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin' and is_active) then raise exception 'denied' using errcode='42501';end if;
  perform set_config('tenops.admin_proposal_delete',p_proposal_id::text,true);
  delete from public.proposal_pdf_documents where proposal_id=p_proposal_id;
  delete from public.proposal_documents where proposal_id=p_proposal_id;
  delete from public.proposal_lines where proposal_id=p_proposal_id;
  delete from public.proposals where id=p_proposal_id;
end$$;

insert into public.app_users values
('${admin}','Admin','admin',true),('${estimator}','Estimator','member',true),
('${inactive}','Inactive','member',false),('${nonAllowlisted}','No Proposal Capability','member',true);
insert into public.proposal_access_users(user_id)values('${estimator}');
insert into public.proposals(id,lineage_id,estimate_base,estimate_number,status,issued_snapshot,customer_name,created_by_user_id,created_by_name)
values
('${issuedLegacy}','${issuedLegacy}','Q26-OLD','Q26-OLD-1.0','issued','{"legacy":true}','Legacy Customer','${admin}','Admin'),
('${draftLegacy}','${draftLegacy}','Q26-DRAFT','Q26-DRAFT-1.0','draft',null,'Legacy Customer','${estimator}','Estimator'),
('${draftLegacyUninitialized}','${draftLegacyUninitialized}','Q26-DRAFT2','Q26-DRAFT2-1.0','draft',null,'Legacy Customer','${estimator}','Estimator');
insert into public.proposal_lines(proposal_id,item_number,description,quantity,rate,total)
values
('${issuedLegacy}','1','Legacy issued',1,100,100),
('${draftLegacy}','1','Legacy draft',1,50,50),
('${draftLegacyUninitialized}','1','Legacy draft without estimate',1,25,25);
insert into public.proposal_pdf_documents(proposal_id,document_version,status)
values('${issuedLegacy}','proposal-pdf-v1','generated');
grant usage on schema public to anon,authenticated,service_role;
grant select,insert,update,delete on public.proposals,public.proposal_lines,public.proposal_documents to authenticated;
grant select on public.proposal_pdf_documents to authenticated;
grant execute on function public.create_proposal(),public.admin_delete_issued_proposal(uuid),public.has_proposal_access() to authenticated;
`;

const stIgnacioInputs = `jsonb_build_object(
  'geometryProfile','flat','customerQuantity',43,'lengthInches',48,'widthInches',24,
  'riserHeightInches',null,'thicknessInches',0.375,'depthInches',null,
  'roughLengthInches',50,'roughWidthInches',50,'roughThicknessInches',0.5,
  'productionQuantityOverride',null,'finish','200 grit','sealer','Plaza Plus',
  'resinColor','KRC 001 White','filler','HSF-20','colorPlate','SW-20-1062 TZ',
  'chipBlend',jsonb_build_array(
    jsonb_build_object('id','china-white','color','China White Marble #1','percentage',90,'size','#1','materialType','Marble','vendor','KCI','unitCostPerBag',20),
    jsonb_build_object('id','mirror','color','KCI SA Mirror #1','percentage',10,'size','#1','materialType','Glass','vendor','KCI','unitCostPerBag',45)
  )
)`;

const tests = String.raw`
\set ON_ERROR_STOP on
do $$begin
  if exists(select 1 from public.proposal_estimates) then raise exception 'Migration backfilled legacy Proposals';end if;
  if (select issued_snapshot from public.proposals where id='${issuedLegacy}') is distinct from '{"legacy":true}'::jsonb then raise exception 'Legacy issue snapshot changed';end if;
  if (select document_version from public.proposal_pdf_documents where proposal_id='${issuedLegacy}')<>'proposal-pdf-v1' then raise exception 'Legacy PDF version changed';end if;
end$$;

select set_config('request.jwt.claim.sub','${estimator}',false);
do $$begin perform public.issue_proposal('${draftLegacyUninitialized}');end$$;
do $$declare snap jsonb:=(select issued_snapshot from public.proposals where id='${draftLegacyUninitialized}');begin
  if (select status from public.proposals where id='${draftLegacyUninitialized}')<>'issued'
     or not exists(select 1 from public.proposal_estimates where proposal_id='${draftLegacyUninitialized}')
     or coalesce(jsonb_typeof(snap -> 'estimate'),'')<>'object'
     or coalesce(jsonb_typeof(snap #> '{estimate,inputs}'),'')<>'object'
     or coalesce(jsonb_typeof(snap #> '{estimate,default_assumptions}'),'')<>'object'
     or coalesce(jsonb_typeof(snap #> '{estimate,assumption_overrides}'),'')<>'object'
     or coalesce(jsonb_typeof(snap #> '{estimate,effective_assumptions}'),'')<>'object'
     or coalesce(jsonb_typeof(snap #> '{estimate,outputs}'),'')<>'object'
     or snap #>> '{estimate,calculation_version}'<>'proposal-estimate-v2'
     or (select document_version from public.proposal_pdf_documents where proposal_id='${draftLegacyUninitialized}')<>'proposal-pdf-v2' then
    raise exception 'Legacy draft was not initialized into a complete Proposal V2 issue snapshot';
  end if;
end$$;
insert into test_ids values('first',public.create_proposal());
do $$declare payload jsonb:=public.get_current_proposal_estimating_defaults();first_id uuid:=(select id from test_ids where name='first');begin
  if payload->>'version'<>'1' or not exists(select 1 from public.proposal_estimates where proposal_id=first_id and default_assumptions->>'materialDensityLbPerCubicFoot'='140') then raise exception 'Initial defaults were not captured';end if;
end$$;
do $$begin
  perform public.save_proposal_estimating_defaults(
    (public.get_current_proposal_estimating_defaults()->'assumptions')||'{"materialDensityLbPerCubicFoot":145}'::jsonb,
    1,
    'Density update'
  );
end$$;
do $$begin
  begin perform public.save_proposal_estimating_defaults(public.get_current_proposal_estimating_defaults()->'assumptions',1,null);raise exception 'Stale defaults edit accepted';exception when serialization_failure then null;end;
  if (select default_assumptions->>'materialDensityLbPerCubicFoot' from public.proposal_estimates where proposal_id=(select id from test_ids where name='first'))<>'140' then raise exception 'Existing Estimate defaults changed';end if;
end$$;
insert into test_ids values('second',public.create_proposal());
do $$begin
  if (select d.version from public.proposal_estimates e join public.proposal_estimating_default_versions d on d.id=e.defaults_version_id where e.proposal_id=(select id from test_ids where name='second'))<>2 then raise exception 'New Estimate did not use new defaults';end if;
  if exists(select 1 from public.proposal_estimates where proposal_id='${draftLegacy}') then raise exception 'Legacy draft initialized implicitly';end if;
end$$;
do $$begin perform public.ensure_proposal_estimate('${draftLegacy}');end$$;
do $$begin
  if (select d.version from public.proposal_estimates e join public.proposal_estimating_default_versions d on d.id=e.defaults_version_id where e.proposal_id='${draftLegacy}')<>2 then raise exception 'Legacy draft explicit initialization failed';end if;
  begin perform public.ensure_proposal_estimate('${issuedLegacy}');raise exception 'Legacy issued Proposal acquired Estimate';exception when no_data_found then null;end;
end$$;
do $$begin
  perform public.save_proposal_v2_draft(
    jsonb_build_object(
      'id',(select id from test_ids where name='first'),'proposal_date','2026-09-08',
      'customer_name','St Ignacio','customer_street','100 Main','customer_city','Dallas',
      'customer_state','TX','customer_postal_code','75001','customer_contact_name','Pat',
      'customer_office_phone','111','customer_mobile_phone','222','customer_email','pat@example.test',
      'project_name','School','tax_enabled',false,'freight_estimate',123,
      'preliminary_drawings_attached',true,'crating_included',false,
      'cut_tickets_included',true,'field_dimensioning_excluded',false
    ),
    jsonb_build_array(jsonb_build_object(
      'line_type','product','item_number','1','description','Epoxy slab','quantity',2,'unit','ea.',
      'rate',10,'total',999,'geometry_profile','flat',
      'dimension_applicability',jsonb_build_object('length',true,'width',true,'thickness',true),
      'length_inches',48,'width_inches',24,'riser_height_inches',null,'thickness_inches',0.375,
      'cubic_feet',10.75,'linear_feet',172,'estimated_weight_pounds',1505
    )),
    ${stIgnacioInputs},
    '{"materialDensityLbPerCubicFoot":150}'::jsonb
  );
end$$;
do $$declare first_id uuid:=(select id from test_ids where name='first');begin
  perform public.save_proposal_draft(
    jsonb_build_object(
      'id',first_id,'proposal_date','2026-09-08','customer_name','St Ignacio',
      'project_name','School','tax_enabled',false
    ),
    jsonb_build_array(jsonb_build_object(
      'line_type','product','item_number','1','description','Epoxy slab',
      'quantity',2,'unit','ea.','rate',10
    ))
  );
  if not exists(select 1 from public.proposals where id=first_id
      and customer_street='100 Main' and customer_city='Dallas' and customer_state='TX'
      and customer_postal_code='75001' and customer_contact_name='Pat'
      and customer_office_phone='111' and customer_mobile_phone='222'
      and customer_email='pat@example.test')
     or not exists(select 1 from public.proposal_lines where proposal_id=first_id
      and geometry_profile='flat'
      and dimension_applicability='{"length":true,"width":true,"thickness":true}'::jsonb
      and length_inches=48 and width_inches=24 and riser_height_inches is null
      and thickness_inches=.375 and cubic_feet=10.75 and linear_feet=172
      and estimated_weight_pounds=1505) then
    raise exception 'Legacy draft save erased omitted Proposal V2 customer or geometry values';
  end if;

  perform public.save_proposal_draft(
    jsonb_build_object(
      'id',first_id,'proposal_date','2026-09-08','customer_name','St Ignacio',
      'customer_city','Austin','project_name','School','tax_enabled',false
    ),
    jsonb_build_array(jsonb_build_object(
      'line_type','product','item_number','1','description','Epoxy slab',
      'quantity',2,'unit','ea.','rate',10,'geometry_profile','custom',
      'dimension_applicability',jsonb_build_object('length',false),
      'length_inches',60,'thickness_inches',null
    ))
  );
  if not exists(select 1 from public.proposals where id=first_id and customer_city='Austin')
     or not exists(select 1 from public.proposal_lines where proposal_id=first_id
      and geometry_profile='custom' and dimension_applicability='{"length":false}'::jsonb
      and length_inches=60 and thickness_inches is null and width_inches=24
      and cubic_feet=10.75 and linear_feet=172 and estimated_weight_pounds=1505) then
    raise exception 'Legacy draft save did not distinguish explicit Proposal V2 values from omitted keys';
  end if;

  perform public.save_proposal_draft(
    jsonb_build_object(
      'id',first_id,'proposal_date','2026-09-08','customer_name','St Ignacio',
      'customer_city','Dallas','project_name','School','tax_enabled',false
    ),
    jsonb_build_array(jsonb_build_object(
      'line_type','product','item_number','1','description','Epoxy slab',
      'quantity',2,'unit','ea.','rate',10,'geometry_profile','flat',
      'dimension_applicability',jsonb_build_object('length',true,'width',true,'thickness',true),
      'length_inches',48,'width_inches',24,'riser_height_inches',null,'thickness_inches',0.375,
      'cubic_feet',10.75,'linear_feet',172,'estimated_weight_pounds',1505
    ))
  );
end$$;
do $$declare output jsonb:=(select outputs from public.proposal_estimates where proposal_id=(select id from test_ids where name='first'));begin
  if output#>>'{production,effectiveQuantity}'<>'44' then raise exception 'Production quantity not authoritative';end if;
  if abs((output#>>'{geometry,customerEstimatedWeightLb}')::numeric-1612.5)>.0001 then raise exception 'Override calculation failed';end if;
  if abs((output#>>'{geometry,customerCubicFeet}')::numeric-10.75)>.0001
     or abs((output#>>'{geometry,productionLinearFeet}')::numeric-176)>.0001
     or abs((output#>>'{production,roughCubicFeet}')::numeric-15.9143518519)>.0001
     or abs((output#>>'{production,batchCount}')::numeric-9.0000016128)>.0001
     or abs((output#>>'{materials,totalCost}')::numeric-2611.0074016733)>.001
     or abs((output#>>'{freight,totalCost}')::numeric-701.3392445560)>.001
     or abs((output#>>'{labor,totalHours}')::numeric-63.3498103697)>.001
     or abs((output#>>'{labor,totalCost}')::numeric-3167.4905184867)>.001
     or abs((output#>>'{shop,totalCost}')::numeric-1199.8070145783)>.001
     or abs((output#>>'{pricing,baseCost}')::numeric-7679.6441792943)>.001
     or abs((output#>>'{pricing,totalMarkup}')::numeric-3071.8576717177)>.001
     or abs((output#>>'{pricing,repFee}')::numeric-537.5750925506)>.001
     or abs((output#>>'{pricing,internalTotal}')::numeric-11289.0769435627)>.001
     or abs((output#>>'{pricing,internalCalculatedUnitMetric}')::numeric-256.5699305355)>.001 then
    raise exception 'Server Estimate diverged from the St. Ignacio golden fixture';
  end if;
  if (select default_assumptions->>'materialDensityLbPerCubicFoot' from public.proposal_estimates where proposal_id=(select id from test_ids where name='first'))<>'140' then raise exception 'Override mutated captured defaults';end if;
end$$;
do $$declare output jsonb:=public.proposal_calculate_estimate_v2(
  ${stIgnacioInputs} || jsonb_build_object(
    'geometryProfile','tread_riser','customerQuantity',10,'widthInches',null,
    'depthInches',12,'riserHeightInches',6,'thicknessInches',0.5
  ),
  (select assumptions from public.proposal_estimating_default_versions order by version desc limit 1)
);begin
  if abs((output#>>'{geometry,developedWidthInches}')::numeric-18)>.0001
     or abs((output#>>'{geometry,customerSquareFeet}')::numeric-60)>.0001
     or abs((output#>>'{geometry,customerCubicFeet}')::numeric-2.5)>.0001 then
    raise exception 'Server tread/riser Depth plus Riser Height geometry is incorrect';
  end if;
end$$;
do $$declare output jsonb:=public.proposal_calculate_estimate_v2(
  ${stIgnacioInputs} || jsonb_build_object(
    'customerQuantity',0,'lengthInches',0,'productionQuantityOverride',0
  ),
  (select assumptions from public.proposal_estimating_default_versions order by version desc limit 1)
);begin
  if output#>>'{production,calculatedQuantity}' is null
     or (output#>>'{production,calculatedQuantity}')::numeric<>0
     or output#>>'{production,effectiveQuantity}' is null
     or (output#>>'{production,effectiveQuantity}')::numeric<>0
     or output#>>'{production,quantitySource}' is distinct from 'override'
     or output#>>'{geometry,customerCubicFeet}' is null
     or (output#>>'{geometry,customerCubicFeet}')::numeric<>0
     or output#>>'{geometry,productionCubicFeet}' is null
     or (output#>>'{geometry,productionCubicFeet}')::numeric<>0
     or output#>>'{geometry,customerLinearFeet}' is null
     or (output#>>'{geometry,customerLinearFeet}')::numeric<>0
     or output#>>'{production,roughCubicFeet}' is null
     or (output#>>'{production,roughCubicFeet}')::numeric<>0
     or output#>>'{production,batchCount}' is null
     or (output#>>'{production,batchCount}')::numeric<>0 then
    raise exception 'Server Estimate collapsed explicit zero into missing/null';
  end if;
end$$;
do $$declare first_id uuid:=(select id from test_ids where name='first');begin
  if (select total from public.proposal_lines where proposal_id=first_id)<>20 or (select total from public.proposals where id=first_id)<>20 then raise exception 'Client line total was trusted';end if;
  if not exists(select 1 from public.proposal_lines where proposal_id=first_id and thickness_inches=.375 and riser_height_inches is null and height_thickness='') then raise exception 'Separate nullable T/RH was not preserved';end if;
  if not exists(select 1 from public.proposals where id=first_id and freight_estimate=123 and preliminary_drawings_attached and cut_tickets_included) then raise exception 'Atomic save omitted commercial clarifications';end if;
end$$;
do $$declare first_id uuid:=(select id from test_ids where name='first');begin
  begin
    perform public.save_proposal_v2_draft(
      jsonb_build_object('id',first_id,'proposal_date','2026-09-08','customer_name','MUST ROLL BACK','tax_enabled',false),
      jsonb_build_array(jsonb_build_object('line_type','product','description','Changed','quantity',3,'rate',9)),
      ${stIgnacioInputs},
      '{"unknownAssumption":1}'::jsonb
    );
    raise exception 'Invalid atomic save unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  if (select customer_name from public.proposals where id=first_id)<>'St Ignacio'
     or (select total from public.proposals where id=first_id)<>20 then
    raise exception 'Failed atomic save left partial Proposal changes';
  end if;
end$$;
do $$begin perform public.issue_proposal((select id from test_ids where name='first'));end$$;
do $$declare first_id uuid:=(select id from test_ids where name='first');snap jsonb:=(select issued_snapshot from public.proposals where id=first_id);begin
  if snap#>>'{estimate,defaults_version}'<>'1'
     or snap#>>'{estimate,default_assumptions,materialDensityLbPerCubicFoot}'<>'140'
     or snap#>>'{estimate,effective_assumptions,materialDensityLbPerCubicFoot}'<>'150'
     or snap#>>'{estimate,outputs,production,effectiveQuantity}'<>'44'
     or snap#>>'{estimate,calculation_version}'<>'proposal-estimate-v2' then raise exception 'Issued Estimate snapshot is incomplete';end if;
  begin update public.proposal_estimates set inputs='{}' where proposal_id=first_id;raise exception 'Issued Estimate mutation accepted';exception when object_not_in_prerequisite_state then null;end;
end$$;
insert into test_ids values('revision',public.create_proposal_revision((select id from test_ids where name='first')));
do $$declare revision_id uuid:=(select id from test_ids where name='revision');begin
  if not exists(select 1 from public.proposal_estimates where proposal_id=revision_id and default_assumptions->>'materialDensityLbPerCubicFoot'='140' and effective_assumptions->>'materialDensityLbPerCubicFoot'='150') then raise exception 'Revision did not clone Estimate';end if;
end$$;
insert into test_ids values('delete',public.create_proposal());
do $$begin
  perform public.save_proposal_draft(
    jsonb_build_object(
      'id',(select id from test_ids where name='delete'),'proposal_date','2026-09-08',
      'customer_name','Disposable','project_name','Cascade check','tax_enabled',false
    ),
    jsonb_build_array(jsonb_build_object(
      'line_type','product','item_number','1','description','Disposable line','quantity',1,'unit','ea.','rate',1
    ))
  );
  perform public.issue_proposal((select id from test_ids where name='delete'));
end$$;

set role authenticated;
do $$begin
  if (select count(*) from public.proposal_estimates)=0
     or (select count(*) from public.proposal_estimating_default_versions)<2 then
    raise exception 'Authorized Proposal user could not read financial Estimate state';
  end if;
  begin update public.proposals set customer_name='bypass' where id=(select id from test_ids where name='second');raise exception 'Direct Proposal DML bypass remained';exception when insufficient_privilege then null;end;
  begin update public.proposal_estimates set inputs='{}';raise exception 'Direct Estimate DML bypass remained';exception when insufficient_privilege then null;end;
end$$;
reset role;

select set_config('request.jwt.claim.sub','${nonAllowlisted}',false);
set role authenticated;
do $$begin
  if public.has_proposal_access() then
    raise exception 'Active non-allowlisted user unexpectedly has Proposal capability';
  end if;
  if (select count(*) from public.proposal_estimates)<>0
     or (select count(*) from public.proposal_estimating_default_versions)<>0 then
    raise exception 'Active non-allowlisted user read financial Estimate state';
  end if;
  begin perform public.get_current_proposal_estimating_defaults();raise exception 'Active non-allowlisted user read defaults';exception when insufficient_privilege then null;end;
  begin perform public.create_proposal();raise exception 'Active non-allowlisted user created a Proposal';exception when insufficient_privilege then null;end;
end$$;
reset role;

select set_config('request.jwt.claim.sub','${inactive}',false);
set role authenticated;
do $$begin
  if (select count(*) from public.proposal_estimates)<>0
     or (select count(*) from public.proposal_estimating_default_versions)<>0 then
    raise exception 'Inactive user read financial Estimate state';
  end if;
  begin perform public.get_current_proposal_estimating_defaults();raise exception 'Inactive user read defaults';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',false);
set role anon;
do $$begin
  begin perform public.get_current_proposal_estimating_defaults();raise exception 'Anonymous user invoked defaults RPC';exception when insufficient_privilege then null;end;
end$$;
reset role;

select set_config('request.jwt.claim.sub','${admin}',false);
do $$begin perform public.admin_delete_issued_proposal((select id from test_ids where name='delete'));end$$;
do $$begin
  if exists(select 1 from public.proposals where id=(select id from test_ids where name='delete'))
     or exists(select 1 from public.proposal_estimates where proposal_id=(select id from test_ids where name='delete')) then raise exception 'Admin issued deletion cascade failed';end if;
  begin update public.proposal_estimating_default_versions set change_note='tamper' where version=1;raise exception 'Default history mutation accepted';exception when object_not_in_prerequisite_state then null;end;
  if (select issued_snapshot from public.proposals where id='${issuedLegacy}') is distinct from '{"legacy":true}'::jsonb then raise exception 'Legacy history changed during test';end if;
  if (select document_version from public.proposal_pdf_documents where proposal_id='${issuedLegacy}')<>'proposal-pdf-v1' then raise exception 'Legacy PDF history changed during test';end if;
end$$;
`;

function run(args,input) {
  const result = spawnSync('docker',args,{input,encoding:'utf8'});
  if (result.status !== 0) {
    const diagnostic = `${result.stdout}\n${result.stderr}`.split('\n').slice(-120).join('\n');
    throw new Error(diagnostic);
  }
  return result.stdout;
}

try {
  run(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=postgres',image]);
  for (let attempt=0;attempt<80;attempt+=1) {
    const ready = spawnSync('docker',[
      'exec','-e','PGPASSWORD=postgres',container,'psql','-U','supabase_admin','-d','postgres',
      '-tAc',"select exists(select 1 from pg_roles where rolname='postgres')",
    ],{encoding:'utf8'});
    if (ready.status===0 && ready.stdout.trim()==='t') break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);
    if (attempt===79) throw new Error('Disposable PostgreSQL did not become ready.');
  }
  // The Supabase image briefly accepts connections before its initialization
  // supervisor performs one final PostgreSQL restart. Let that settle so the
  // migration transaction cannot be terminated mid-verification.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,12000);
  run(['exec','-e','PGPASSWORD=postgres',container,'psql','-U','supabase_admin','-d','postgres','-tAc','select 1']);
  run(['exec','-e','PGPASSWORD=postgres','-i',container,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],setup+migration+tests);
  console.log('Proposal V2 schema/default/snapshot/RBAC checks passed.');
} finally {
  spawnSync('docker',['stop',container]);
}
