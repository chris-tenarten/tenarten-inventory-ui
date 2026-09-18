import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const image = 'postgres:17.6';
const member = '00000000-0000-0000-0000-000000000002';
const migrationFiles = [
  '20260901_005_sample_color_plate_generator.sql',
  '20260917_001_sample_formulation_foundation.sql',
  '20260917_002_sample_draft_library_identity.sql',
  '20260917_007_sample_formula_mass_balance.sql',
  '20260918_001_sample_formula_historical_parity.sql',
  '20260918_003_sample_formula_volumetric_profiles.sql',
  '20260918_004_sample_formula_density_profiles.sql',
];

const migrations = migrationFiles
  .map((file) => readFileSync(`supabase/migrations/${file}`, 'utf8'))
  .join('\n');
const preconditionMigrations = migrationFiles.slice(0,-1)
  .map((file) => readFileSync(`supabase/migrations/${file}`, 'utf8'))
  .join('\n');
const forwardMigration = readFileSync('supabase/migrations/20260918_004_sample_formula_density_profiles.sql','utf8');

const bootstrap = `
drop extension if exists pg_graphql cascade;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='supabase_storage_admin') then create role supabase_storage_admin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create schema if not exists storage authorization supabase_storage_admin;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.app_users(user_id uuid primary key,display_name text,role text,is_active boolean);
create table public.jobs(id uuid primary key,name text,customer text,job_number text);
create table public.bids(id uuid primary key,customer text,project_name text);
set role supabase_storage_admin;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text);
grant all on storage.buckets,storage.objects to postgres;
reset role;
create function public.tenops_touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=clock_timestamp();return new;end$$;
create function public.has_app_capability(text) returns boolean language sql stable security definer as $$select exists(select 1 from public.app_users where user_id=auth.uid() and is_active)$$;
create function public.require_app_capability(text) returns void language plpgsql security definer as $$begin if not public.has_app_capability('x') then raise exception 'denied' using errcode='42501'; end if;end$$;
insert into public.app_users values ('${member}','Member','member',true);
`;

const aggregateRows = `jsonb_build_array(
  jsonb_build_object('percentage','40','color','A','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated'),
  jsonb_build_object('percentage','30','color','B','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated'),
  jsonb_build_object('percentage','20','color','C','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated'),
  jsonb_build_object('percentage','5','color','D','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated'),
  jsonb_build_object('percentage','5','color','E','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated')
)`;

const tests = `
select set_config('request.jwt.claim.sub','${member}',false);
create temp table ids(name text primary key,id uuid);
insert into ids values ('v4',public.create_sample()),('v3',public.create_sample());

do $$ begin
  if has_function_privilege('authenticated','public.save_sample_draft_v4_003(jsonb,jsonb)','EXECUTE') then
    raise exception 'legacy 003 save helper remains callable by authenticated';
  end if;
end $$;

do $$
declare s uuid := (select id from ids where name='v4');
begin
  if (select formulation_state->>'calculationVersion' from public.samples where id=s) <> 'sample-formulation-v4-density-profile' then
    raise exception 'new Sample did not use corrected V4';
  end if;
end $$;

select public.save_sample_draft(
  jsonb_build_object(
    'id',(select id from ids where name='v4'),
    'prepared_by','Member',
    'calculation_version','sample-formulation-v4-density-profile',
    'formulation_state',(select formulation_state from public.samples where id=(select id from ids where name='v4')) || jsonb_build_object(
      'basis','weight_per_sf','length','12','width','12','dimensionUnit','in',
      'materialDensity','128','chipDensityProvenance','profile_default',
      'thicknessIn','0.375','resinParts','5','hardenerParts','1',
      'ratioProvenance','default','supplierRatioDefaults',jsonb_build_object(),
      'fillerProvenance','profile_default','calculationVersion','sample-formulation-v4-density-profile'
    )
  ),
  ${aggregateRows} || jsonb_build_array(
    jsonb_build_object('color','Filler','quantity','18','unit','oz','component_role','filler','quantity_provenance','manual'),
    jsonb_build_object('color','Resin','quantity','15','unit','fl oz','component_role','resin','quantity_provenance','manual'),
    jsonb_build_object('color','Hardener','unit','fl oz','component_role','hardener','quantity_provenance','calculated')
  )
);

do $$
declare s uuid := (select id from ids where name='v4');
begin
  if (select array_agg(quantity order by display_order) from public.sample_blend_rows where sample_id=s)
     <> array[25.6,19.2,12.8,3.2,3.2,18,15,3]::numeric[] then
    raise exception 'corrected V4 defaults failed: %', (select array_agg(quantity order by display_order) from public.sample_blend_rows where sample_id=s);
  end if;
  if abs((select formulation_state#>>'{derived,availableChipMixOz}' from public.samples where id=s)::numeric - 64) > .0005 then
    raise exception 'corrected V4 Chip Mix failed: %', (select formulation_state from public.samples where id=s);
  end if;
end $$;

-- Ordinary Filler editing is independent and must not alter density-derived Chip Mix.
select public.save_sample_draft(
  (select to_jsonb(x) || jsonb_build_object('formulation_state',x.formulation_state) from public.samples x where id=(select id from ids where name='v4')),
  ${aggregateRows} || jsonb_build_array(
    jsonb_build_object('color','Filler','quantity','22','unit','oz','component_role','filler','quantity_provenance','manual'),
    jsonb_build_object('color','Resin','quantity','15','unit','fl oz','component_role','resin','quantity_provenance','manual'),
    jsonb_build_object('color','Hardener','unit','fl oz','component_role','hardener','quantity_provenance','calculated')
  )
);

do $$
declare s uuid := (select id from ids where name='v4');
begin
  if abs((select formulation_state#>>'{derived,availableChipMixOz}' from public.samples where id=s)::numeric - 64) > .0005 then
    raise exception 'direct Filler edit incorrectly changed Chip Mix: %', (select formulation_state#>>'{derived,availableChipMixOz}' from public.samples where id=s);
  end if;
  if abs((select formulation_state#>>'{derived,dryPoolVarianceOz}' from public.samples where id=s)::numeric - 4) > .0005 then
    raise exception 'dry-pool variance was not preserved as advisory evidence';
  end if;
end $$;

-- Explicit Increased Filler adjustment coordinates Filler and effective density.
select public.save_sample_draft(
  (select to_jsonb(x) || jsonb_build_object('formulation_state',x.formulation_state || jsonb_build_object(
    'materialDensity','120','chipDensityProvenance','increased_filler_adjustment',
    'fillerProvenance','increased_filler_adjustment',
    'adjustment',jsonb_build_object(
      'kind','increased_filler_preserve_dry_pool','baseProfileId','generic-epoxy-standard-200-5to1','baseProfileVersion','2','priorFillerOz','18','targetFillerOz','22',
      'priorChipMixOz','64','resultingChipMixOz','60',
      'priorChipDensityLbCft','128','resultingChipDensityLbCft','120',
      'expectedDryPoolOz','82'
    )
  )) from public.samples x where id=(select id from ids where name='v4')),
  ${aggregateRows} || jsonb_build_array(
    jsonb_build_object('color','Filler','quantity','22','unit','oz','component_role','filler','quantity_provenance','manual'),
    jsonb_build_object('color','Resin','quantity','15','unit','fl oz','component_role','resin','quantity_provenance','manual'),
    jsonb_build_object('color','Hardener','unit','fl oz','component_role','hardener','quantity_provenance','calculated')
  )
);

do $$
declare s uuid := (select id from ids where name='v4'); version_id uuid; issued_id uuid;
begin
  if (select array_agg(quantity order by display_order) from public.sample_blend_rows where sample_id=s)
     <> array[24,18,12,3,3,22,15,3]::numeric[] then
    raise exception 'explicit adjustment allocation failed: %', (select array_agg(quantity order by display_order) from public.sample_blend_rows where sample_id=s);
  end if;
  if abs((select formulation_state#>>'{derived,dryPoolVarianceOz}' from public.samples where id=s)::numeric) > .0005 then
    raise exception 'explicit adjustment did not preserve dry pool';
  end if;
  version_id := public.save_sample_working_version(s,'Adjusted checkpoint');
  perform public.restore_sample_working_version(s,version_id);
  issued_id := public.issue_sample_form(s);
  if (select version_snapshot#>>'{formulation_state,adjustment,kind}' from public.sample_working_versions where id=version_id) <> 'increased_filler_preserve_dry_pool' then
    raise exception 'working version lost adjustment provenance';
  end if;
  if (select issued_snapshot#>>'{formulation_state,calculationVersion}' from public.sample_issued_documents where id=issued_id) <> 'sample-formulation-v4-density-profile' then
    raise exception 'issued snapshot lost corrected V4 version';
  end if;
end $$;

-- V3 remains dispatched through its captured semantics.
select public.save_sample_draft(
  jsonb_build_object('id',(select id from ids where name='v3'),'prepared_by','Member','calculation_version','sample-formulation-v3-historical-parity','formulation_state',jsonb_build_object(
    'basis','weight_per_sf','length','12','width','6','dimensionUnit','in','materialDensity','128','thicknessIn','0.375',
    'resinParts','5','hardenerParts','1','ratioProvenance','default','supplierRatioDefaults',jsonb_build_object(),
    'calculationVersion','sample-formulation-v3-historical-parity'
  )),
  jsonb_build_array(
    jsonb_build_object('percentage','20','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated'),
    jsonb_build_object('percentage','40','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated'),
    jsonb_build_object('percentage','40','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated'),
    jsonb_build_object('quantity','36','unit','oz','component_role','filler','quantity_provenance','manual'),
    jsonb_build_object('quantity','7.5','unit','fl oz','component_role','resin','quantity_provenance','manual'),
    jsonb_build_object('unit','fl oz','component_role','hardener','quantity_provenance','calculated')
  )
);
do $$ declare s uuid := (select id from ids where name='v3'); begin
  if (select array_agg(quantity order by display_order) filter(where component_role='aggregate') from public.sample_blend_rows where sample_id=s)
     <> array[6.4,12.8,12.8]::numeric[] then raise exception 'V3 compatibility changed'; end if;
end $$;

select 'corrected Sample V4 migration verifier passed';
`;

function run(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

const name = `tenops-sample-density-profile-${process.pid}`;
try {
  run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres',image]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (spawnSync('docker',['exec',name,'pg_isready','-U','postgres']).status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);
  }
  if (!ready) throw new Error('PostgreSQL did not become ready');
  run(['exec','-i',name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],bootstrap+migrations+tests);
  console.log('Sample density-profile migration checks passed.');
} finally {
  spawnSync('docker',['stop',name]);
}

const guardName = `tenops-sample-density-guard-${process.pid}`;
try {
  run(['run','--rm','-d','--name',guardName,'-e','POSTGRES_PASSWORD=postgres',image]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (spawnSync('docker',['exec',guardName,'pg_isready','-U','postgres']).status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);
  }
  if (!ready) throw new Error('Guard PostgreSQL did not become ready');
  run(['exec','-i',guardName,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],bootstrap+preconditionMigrations+`select set_config('request.jwt.claim.sub','${member}',false); select public.create_sample();`);
  const blocked = spawnSync('docker',['exec','-i',guardName,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:forwardMigration,encoding:'utf8'});
  const guardOutput = `${blocked.stdout}\n${blocked.stderr}`;
  if (blocked.status === 0 || !guardOutput.includes('operational 003-V4 records exist')) {
    throw new Error(`Forward-004 precondition guard did not reject operational 003-V4 data.\n${guardOutput}`);
  }
  console.log('Forward-004 operational-data precondition guard passed.');
} finally {
  spawnSync('docker',['stop',guardName]);
}
