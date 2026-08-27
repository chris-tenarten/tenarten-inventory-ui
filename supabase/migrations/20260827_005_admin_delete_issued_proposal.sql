-- Narrow Admin escape hatch for an erroneously issued Proposal.
create or replace function public.admin_delete_issued_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
begin
  if not exists (
    select 1 from public.app_users
    where user_id=auth.uid() and is_active and role='admin'
  ) then
    raise exception 'Only an active Admin may delete an issued Proposal.' using errcode='42501';
  end if;
  if not exists (select 1 from public.proposals where id=p_proposal_id and status='issued') then
    raise exception 'Issued Proposal not found.' using errcode='P0002';
  end if;
  if exists (select 1 from public.proposals where prior_proposal_id=p_proposal_id) then
    raise exception 'A Proposal with revisions cannot be deleted.' using errcode='55000';
  end if;

  perform set_config('tenops.admin_proposal_delete',p_proposal_id::text,true);
  delete from public.proposal_pdf_documents where proposal_id=p_proposal_id;
  delete from public.proposal_documents where proposal_id=p_proposal_id;
  delete from public.proposal_lines where proposal_id=p_proposal_id;
  delete from public.proposals where id=p_proposal_id;
end;
$$;

create or replace function public.proposal_issued_immutable()
returns trigger language plpgsql as $$
begin
  if old.status='issued' and not (
    tg_op='DELETE'
    and current_setting('tenops.admin_proposal_delete',true)=old.id::text
    and exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin')
  ) then
    raise exception 'Issued Proposals are immutable. Create a revision.' using errcode='55000';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function public.proposal_line_issued_immutable()
returns trigger language plpgsql as $$
begin
  if exists(select 1 from public.proposals p where p.id=old.proposal_id and p.status='issued')
    and not (
      tg_op='DELETE'
      and current_setting('tenops.admin_proposal_delete',true)=old.proposal_id::text
      and exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin')
    ) then
    raise exception 'Issued Proposal lines are immutable. Create a revision.' using errcode='55000';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function public.admin_delete_issued_proposal(uuid) from public,anon;
grant execute on function public.admin_delete_issued_proposal(uuid) to authenticated,service_role;
