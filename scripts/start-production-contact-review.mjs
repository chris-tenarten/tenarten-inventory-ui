// Actual TenOps with disposable localhost Supabase. Never uses .env.local/hosted credentials.
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { localConfig,sql,migration } from './support/production-contact-local.mjs';
if(process.argv.includes('--prepare-config')){
 let s=await readFile('auth-qa/supabase/config.toml','utf8');
 s=s.replaceAll('tenops-auth-qa','tenops-contact-review');
 for(const [a,b] of [['54321','55581'],['54322','55582'],['54320','55580'],['54324','55584'],['54325','55585'],['54326','55586']])s=s.replaceAll(a,b);
 s=s.slice(0,s.indexOf('[auth.email.template.confirmation]'))+s.slice(s.indexOf('[edge_runtime]'));
 s=s.replace('enable_confirmations = true','enable_confirmations = false').replace('http://localhost:3000','http://localhost:3001').replace('http://127.0.0.1:3000','http://127.0.0.1:3001');
 await mkdir('.tmp-contact-supabase/supabase',{recursive:true});await writeFile('.tmp-contact-supabase/supabase/config.toml',s);process.exit(0);
}
const cfg=localConfig();
if(process.argv.includes('--seed')){
 if(sql("select to_regclass('public.production_companies') is not null;")==='t')throw Error('Already seeded; refusing to overwrite local review records.');
 const read=name=>readFile('supabase/migrations/'+name,'utf8');
 if(sql("select to_regclass('public.app_users') is not null;")!=='t'){
 sql(await read('20260713_002_production_mvp_jobs.sql'));
 const identity=await read('20260818_001_rbac_identity_infrastructure.sql');
 sql(identity.split('alter table public.job_updates')[0]+identity.slice(identity.indexOf('alter table public.app_users enable row level security')));
 // Load the released capability implementation, without executing unrelated lifecycle migrations.
 sql("alter table public.app_users add column read_only boolean not null default false,add column messaging_write boolean not null default false,add column production_blend_manage boolean not null default false,add column sample_labels_generate boolean not null default false;insert into public.app_role_capabilities(role,capability) select role,'writeBusinessData' from (values('guest'),('member'),('lead'),('developer'),('admin')) r(role);");
 const latest=await read('20261013180000_sample_label_capability.sql');
 sql(latest.slice(latest.indexOf('create or replace function public.has_app_capability'),latest.indexOf('drop function public.admin_list_app_access')).replace('drop function public.get_my_app_access();','drop function if exists public.get_my_app_access();'));
 // Unrelated modules get empty local fixtures so the actual Production workspace can enrich normally.
 sql(`create table public.production_rework_cycles(id uuid primary key default gen_random_uuid(),job_id uuid references public.jobs,sequence_number integer,reason_category text,scope_details text,intake_date date,production_status text,planned_start date,planned_end date,created_by text,completed_at timestamptz,completed_by text,created_at timestamptz,updated_at timestamptz);
 create table public.job_updates(id uuid primary key default gen_random_uuid(),job_id uuid references public.jobs,author_name text,author_user_id uuid,body text,requires_follow_up boolean,resolved_at timestamptz,follow_up_assignee_name text,follow_up_assignee_user_id uuid,resolved_by_name text,resolved_by_user_id uuid,resolution_message text,edited_at timestamptz,created_at timestamptz);
 create table public.job_attachments(id uuid primary key,job_id uuid,file_name text,storage_path text,mime_type text,size_bytes bigint,document_type text,uploaded_by text,job_update_id uuid,job_update_attachment_role text,created_at timestamptz);
 create table public.manpower_entries(id uuid primary key,job_id uuid,am_hours numeric,pm_hours numeric,production_rework_cycle_id uuid);
 create table public.material_usage_reports(id uuid primary key,job_id uuid,report_date date);
 create table public.planning_phases(id uuid primary key,job_id uuid,library_phase_id uuid,name text,description text,sort_order integer,planned_start date,planned_end date,status text,created_at timestamptz,updated_at timestamptz);
 create function public.get_my_account_preferences() returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.ensure_my_welcome_notification() returns void language sql as $$select$$;
 create function public.list_my_account_notifications() returns jsonb language sql as $$select '[]'::jsonb$$;
 create function public.list_my_unseen_job_update_jobs() returns jsonb language sql as $$select '[]'::jsonb$$;
 create function public.mark_my_job_updates_seen(p_job_id uuid) returns void language sql as $$select$$;
 `);
 // Model the released compatibility Jobs read/write boundary plus read-only guard.
 sql(`drop policy "Allow anon read jobs" on public.jobs;drop policy "Allow anon insert jobs" on public.jobs;drop policy "Allow anon update jobs" on public.jobs;drop policy "Allow anon delete jobs" on public.jobs;
 revoke all on public.jobs,public.job_activity from anon;
 create policy fixture_jobs_read on public.jobs for select to authenticated using(public.has_app_capability('readOperationalData'));
 create policy fixture_jobs_insert on public.jobs for insert to authenticated with check(public.has_app_capability('writeBusinessData'));
 create policy fixture_jobs_update on public.jobs for update to authenticated using(public.has_app_capability('writeBusinessData')) with check(public.has_app_capability('writeBusinessData'));
 create policy fixture_activity_read on public.job_activity for select to authenticated using(public.has_app_capability('readOperationalData'));
 create policy fixture_activity_insert on public.job_activity for insert to authenticated with check(public.has_app_capability('writeBusinessData'));
 grant select,insert,update on public.jobs,public.job_activity to authenticated;grant all on public.jobs to service_role;
 do $$declare t text;begin foreach t in array array['production_rework_cycles','job_updates','job_attachments','manpower_entries','material_usage_reports','planning_phases'] loop execute format('alter table public.%I enable row level security',t);execute format('grant select on public.%I to authenticated',t);execute format('create policy fixture_read on public.%I for select to authenticated using(public.has_app_capability(''readOperationalData''))',t);end loop;end$$;`);
 }
 sql(await read(migration));
 sql(await read('20261014210000_production_customer_list.sql'));
 sql(await read('20261014220000_protected_job_contacts.sql'));
 sql(await read('20261014221000_defer_project_contact_detachment.sql'));
 sql(await read('20261014222000_preserve_archived_project_contact_refresh.sql'));
 sql("insert into public.jobs(name,customer,job_number,remarks) values('Historical review Project','Historical Stoneworks','LOCAL-HISTORICAL','Keep this historical text unchanged.');notify pgrst,'reload schema';");
 const service=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const accounts=[];
 for(const [role,readOnly,active,suffix] of [['admin',false,true,'admin'],['lead',false,true,'lead'],['member',false,true,'member'],['guest',false,true,'guest'],['guest',true,true,'reader'],['developer',false,true,'developer'],['member',false,false,'inactive'],['member',false,true,'other-member']]){
  const email=`contact-${suffix}@example.invalid`,password='Local-contact-review-2026!';
  const r=await service.auth.admin.createUser({email,password,email_confirm:true});if(r.error)throw r.error;
  sql(`insert into public.app_users(user_id,display_name,role,is_active,read_only) values('${r.data.user.id}','Contact Review ${suffix}','${role}',${active},${readOnly});`);
  accounts.push({email,password,role,readOnly,active,id:r.data.user.id});
 }
 await mkdir('.tmp-contact-review',{recursive:true});await writeFile('.tmp-contact-review/accounts.json',JSON.stringify(accounts,null,2),{mode:0o600});
 console.log('Isolated contact review database seeded. Local login: contact-admin@example.invalid / Local-contact-review-2026!');process.exit(0);
}
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:cfg.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:cfg.ANON_KEY,NEXT_PUBLIC_RBAC_MODE:'enforced',RBAC_ENFORCED:'true',NEXT_PUBLIC_DEV_BRANDING:'false'};
// Worktree contains no hosted .env files. Build and review share this exact local environment.
const child=spawn('npm',process.argv.includes('--build')?['run','build']:['run','dev','--','--hostname','localhost','--port','3001'],{env,stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
