/** OFFLINE ONLY: validates local PDFs and emits reviewable SQL/Storage plans. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const source='scripts/fixtures/intake-demo-final/manifest.json';
const bytes=readFileSync(source),m=JSON.parse(bytes),out=resolve('output/intake-demo');
const sha=data=>createHash('sha256').update(data).digest('hex');
const q=value=>value===null?'null':`'${String(value).replaceAll("'","''")}'`;
const json=value=>`${q(JSON.stringify(value))}::jsonb`;
if(m.records.length!==8||new Set(m.records.map(r=>r.fields.id)).size!==8)throw Error('Expected eight distinct Bids');
if(m.owner.display_name!=='Chris Ngo'||m.owner.role!=='admin')throw Error('Owner differs from reviewed proposal');
for(const r of m.records){
 const f=r.attachment,pdf=readFileSync(f.local_path);
 if(sha(pdf)!==f.sha256||pdf.length!==f.byte_size||f.storage_path!==`${r.fields.id}/${f.id}`||f.bucket!=='bid-files')throw Error('Attachment mismatch');
 if(!r.fields.project_name.startsWith('TEST — ')||!r.fields.notes.startsWith(m.marker)||r.fields.production_job_id!==null||r.fields.converted_at!==null)throw Error('Unsafe manifest');
}
mkdirSync(out,{recursive:true});
const payload=json(m.records),owner=q(m.owner.user_id),ids=m.records.map(r=>q(r.fields.id)).join(',');
const start=`begin;\nset local lock_timeout='10s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext(${q(m.marker)}));\n`;
function guard(required=false,phase='seed'){
 return `do $guard$
declare r jsonb;b public.bids%rowtype;f public.canonical_files%rowtype;rel public.bid_file_relationships%rowtype;expected jsonb;n integer;
begin
 if not exists(select 1 from public.app_users where user_id=${owner}::uuid and display_name=${q(m.owner.display_name)} and role='admin' and is_active) then raise exception 'Chris owner identity/role assumption changed';end if;
 if not exists(select 1 from public.app_role_capabilities where role='admin' and capability='accessIntake') then raise exception 'Intake capability unavailable';end if;
 for r in select value from jsonb_array_elements(${payload}) loop
  select * into b from public.bids where id=(r->'fields'->>'id')::uuid;
  if not found then
   ${required?"raise exception 'Expected fixture Bid missing';":"if exists(select 1 from public.canonical_files where id=(r->'attachment'->>'id')::uuid) then raise exception 'Orphan/foreign file identity';end if;continue;"}
  end if;
  if b.production_job_id is not null or b.converted_at is not null then raise exception 'Converted fixture is protected: stop the entire operation before Storage deletion';end if;
  if not(to_jsonb(b) @> (r->'fields')) then raise exception 'Fixture identity/content changed: %',b.id;end if;
  if exists(select 1 from public.samples where bid_id=b.id) or exists(select 1 from public.bid_proposal_relationships where bid_id=b.id) or exists(select 1 from public.job_activity where metadata->>'source_bid_id'=b.id::text) then raise exception 'New document/conversion relationship: separate review required';end if;
  if (select count(*) from public.bid_updates where bid_id=b.id)<>jsonb_array_length(r->'updates') or exists(select 1 from public.bid_updates u where u.bid_id=b.id and not exists(select 1 from jsonb_array_elements(r->'updates') x where x->>'id'=u.id::text and x->>'body'=u.body and u.author_user_id=${owner}::uuid)) then raise exception 'Fixture Updates changed';end if;
  if exists(select 1 from public.bid_activity a where a.bid_id=b.id and not exists(select 1 from jsonb_array_elements(r->'activities') x where x->>'id'=a.id::text and x->>'activity_type'=a.activity_type and x->'details'=a.details and a.actor_user_id=${owner}::uuid) and not(a.activity_type='file_added' and a.actor_user_id=${owner}::uuid and a.details=jsonb_build_object('file_id',r->'attachment'->>'id'))) then raise exception 'Unexpected fixture activity';end if;
  if (select count(*) from public.bid_activity a where a.bid_id=b.id and a.activity_type<>'file_added')<>jsonb_array_length(r->'activities') then raise exception 'Missing/extra base activity';end if;
  if (select count(*) from public.bid_activity a where a.bid_id=b.id and a.activity_type='file_added')>1 then raise exception 'Duplicate file activity';end if;
  select * into f from public.canonical_files where id=(r->'attachment'->>'id')::uuid;
  if not found or f.uploader_user_id<>${owner}::uuid or f.original_filename<>r->'attachment'->>'filename' or f.storage_bucket<>'bid-files' or f.storage_path<>r->'attachment'->>'storage_path' or f.content_type<>'application/pdf' or f.byte_size<>(r->'attachment'->>'byte_size')::bigint then raise exception 'File metadata mismatch';end if;
  if (select count(*) from public.bid_file_relationships where bid_id=b.id)<>1 or (select count(*) from public.bid_file_relationships where file_id=f.id)<>1 then raise exception 'Unexpected/shared file relationships';end if;
  select * into strict rel from public.bid_file_relationships where bid_id=b.id and file_id=f.id;
  if ${phase==='seed'?"not ((f.lifecycle_state='uploading' and rel.relationship_state='uploading') or (f.lifecycle_state='ready' and rel.relationship_state='active'))":phase==='finish-cleanup'?"rel.relationship_state<>'removal_pending'":"rel.relationship_state not in ('uploading','active','removal_pending')"} then raise exception 'Unexpected file lifecycle';end if;
  if f.lifecycle_state='ready' and (select count(*) from public.bid_activity a where a.bid_id=b.id and a.activity_type='file_added')<>1 then raise exception 'Ready file lacks its normal activity';end if;
 end loop;
end $guard$;\n`;
}
let seed=start+guard();
for(const r of m.records){
 const b=r.fields,cols=Object.keys(b),vals=cols.map(k=>q(b[k]));
 seed+=`insert into public.bids(${cols.join(',')},projected_window_updated_at) values(${vals.join(',')},${b.projected_production_start?'clock_timestamp()':'null'}) on conflict(id) do nothing;\n`;
 for(const a of r.activities)seed+=`insert into public.bid_activity(id,bid_id,activity_type,actor_user_id,details,occurred_at) values(${q(a.id)},${q(b.id)},${q(a.activity_type)},${owner},${json(a.details)},clock_timestamp()) on conflict(id) do nothing;\n`;
 for(const u of r.updates)seed+=`insert into public.bid_updates(id,bid_id,author_user_id,body,created_at) values(${q(u.id)},${q(b.id)},${owner},${q(u.body)},clock_timestamp()) on conflict(id) do nothing;\n`;
 const f=r.attachment;
 seed+=`insert into public.canonical_files(id,uploader_user_id,storage_bucket,storage_path,original_filename,content_type,byte_size,lifecycle_state) values(${q(f.id)},${owner},'bid-files',${q(f.storage_path)},${q(f.filename)},'application/pdf',${f.byte_size},'uploading') on conflict(id) do nothing;\n`;
 seed+=`insert into public.bid_file_relationships(bid_id,file_id,relationship_state) values(${q(b.id)},${q(f.id)},'uploading') on conflict(bid_id,file_id) do nothing;\n`;
}
seed+=guard(true)+'commit;\n';
// All rows are locked and validated before any file is marked for removal.
const lock=`select id from public.bids where id in (${ids}) order by id for update;\n`;
const identity=`select set_config('request.jwt.claim.sub',${owner},true);\nset local role authenticated;\n`;
let prepare=start+lock+guard(false,'cleanup')+identity;
for(const r of m.records)prepare+=`select * from public.prepare_admin_delete_bid(${q(r.fields.id)}) where exists(select 1 from public.bids where id=${q(r.fields.id)});\n`;
// Avoid invoking a missing-Bid function at all, rather than relying on SELECT evaluation order.
prepare=start+lock+guard(false,'cleanup')+identity+`do $$declare x uuid;begin for x in select id from public.bids where id in (${ids}) order by id loop perform public.prepare_admin_delete_bid(x);end loop;end$$;\ncommit;\n`;
let cleanup=start+lock+guard(false,'finish-cleanup')+`do $$begin if exists(select 1 from storage.objects where bucket_id='bid-files' and name in (${m.records.map(r=>q(r.attachment.storage_path)).join(',')})) then raise exception 'Remove the exact fixture objects through Storage API first';end if;end$$;\n`+identity;
for(const r of m.records)cleanup+=`do $$begin if exists(select 1 from public.bids where id=${q(r.fields.id)}) then perform public.admin_permanently_delete_bid(${q(r.fields.id)},${q(r.fields.project_name)});end if;end$$;\n`;
cleanup+='reset role;\n'+`do $$begin if exists(select 1 from public.bids where id in (${ids})) or exists(select 1 from public.bid_activity where bid_id in (${ids})) or exists(select 1 from public.bid_updates where bid_id in (${ids})) or exists(select 1 from public.bid_file_relationships where bid_id in (${ids})) or exists(select 1 from public.canonical_files where id in (${m.records.map(r=>q(r.attachment.id)).join(',')})) then raise exception 'Cleanup residue';end if;end$$;\ncommit;\n`;
const verify=`begin read only;\nselect b.id,b.project_name,b.status,b.deposit_received_date,b.projected_production_start,b.projected_production_end,b.production_job_id,(select count(*) from public.bid_updates u where u.bid_id=b.id) updates,(select count(*) from public.bid_activity a where a.bid_id=b.id) activities,(select count(*) from public.bid_file_relationships r join public.canonical_files f on f.id=r.file_id where r.bid_id=b.id and r.relationship_state='active' and f.lifecycle_state='ready') ready_files from public.bids b where b.id in (${ids}) order by b.id;\nselect count(*) storage_objects from storage.objects where bucket_id='bid-files' and name in (${m.records.map(r=>q(r.attachment.storage_path)).join(',')});\ncommit;\n`;
for(const [file,data] of Object.entries({'01-seed-metadata.sql':seed,'02-prepare-cleanup.sql':prepare,'03-finish-cleanup.sql':cleanup,'04-verify.sql':verify,'manifest.json':bytes}))writeFileSync(resolve(out,file),data);
writeFileSync(resolve(out,'approval.json'),JSON.stringify({manifest_sha256:sha(bytes),status:'PREPARED ONLY — no hosted execution',files:m.records.map(r=>r.attachment)},null,2)+'\n');
console.log(JSON.stringify({output:out,manifest_sha256:sha(bytes),bids:8,updates:16,baseActivities:15,attachments:8,finalActivities:23,hostedRequests:0},null,2));
