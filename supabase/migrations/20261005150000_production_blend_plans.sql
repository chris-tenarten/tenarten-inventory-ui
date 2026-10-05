-- Admin-only downstream Production plans. No fixture rows and no Sample/profile changes.
begin;
-- Source UUIDs are immutable provenance, validated by the handler when captured.
-- Self-contained documents survive source deletion without changing Sample cleanup semantics.
create table public.production_blend_plans (
 id uuid primary key default gen_random_uuid(),
 sample_id uuid not null,
 source_document_id uuid,
 source_snapshot jsonb not null,
 inputs jsonb not null,
 model jsonb not null,
 status text not null default 'working' check(status in ('working','issued')),
 revision integer not null default 1 check(revision>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 issued_at timestamptz,
 check ((status='issued')=(issued_at is not null))
);
create index production_blend_plans_sample_idx on public.production_blend_plans(sample_id,created_at desc);
alter table public.production_blend_plans enable row level security;
create policy production_blend_admin_read on public.production_blend_plans for select to authenticated
 using(exists(select 1 from public.app_users u where u.user_id=auth.uid() and u.role='admin' and u.is_active));
revoke all on public.production_blend_plans from anon,authenticated;
grant select on public.production_blend_plans to authenticated;
grant all on public.production_blend_plans to service_role;
create function public.protect_issued_production_blend() returns trigger language plpgsql set search_path=public as $$
begin
 if old.status='issued' then raise exception 'Issued Production Blend Sheets are immutable'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.source_snapshot is distinct from old.source_snapshot or new.sample_id is distinct from old.sample_id or new.source_document_id is distinct from old.source_document_id then raise exception 'Production source capture is immutable; create a new plan'; end if;
 return new;
end $$;
create trigger protect_issued_production_blend before update or delete on public.production_blend_plans for each row execute function public.protect_issued_production_blend();
-- Only the authenticated Edge handler's service client may persist a server-calculated model.
create function public.persist_production_blend(p_actor uuid,p_id uuid,p_revision integer,p_sample_id uuid,p_source_document_id uuid,p_source_snapshot jsonb,p_inputs jsonb,p_model jsonb,p_issue boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare old_plan production_blend_plans; result production_blend_plans;
begin
 if not exists(select 1 from app_users where user_id=p_actor and role='admin' and is_active) then raise exception 'Admin only' using errcode='42501'; end if;
 if p_model->>'version' is distinct from 'production-blend-v1' then raise exception 'Unsupported Production Blend contract'; end if;
 if p_issue and ((p_model->>'adjustment')::numeric<0 or jsonb_array_length(p_model->'warnings')>0) then raise exception 'Correct Production planning warnings before issue'; end if;
 if p_id is null then
  insert into production_blend_plans(sample_id,source_document_id,source_snapshot,inputs,model,created_by,status,issued_at)
   values(p_sample_id,p_source_document_id,p_source_snapshot,p_inputs,p_model,p_actor,case when p_issue then 'issued' else 'working' end,case when p_issue then now() end) returning * into result;
 else
  select * into old_plan from production_blend_plans where id=p_id for update;
  if not found or old_plan.revision is distinct from p_revision then raise exception 'Plan changed; reload before saving' using errcode='40001'; end if;
  update production_blend_plans set inputs=p_inputs,model=p_model,revision=revision+1,updated_at=now(),status=case when p_issue then 'issued' else 'working' end,issued_at=case when p_issue then now() end where id=p_id returning * into result;
 end if;
 return to_jsonb(result);
end $$;
revoke all on function public.persist_production_blend(uuid,uuid,integer,uuid,uuid,jsonb,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.persist_production_blend(uuid,uuid,integer,uuid,uuid,jsonb,jsonb,jsonb,boolean) to service_role;
commit;
