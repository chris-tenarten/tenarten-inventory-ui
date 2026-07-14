begin;

create table public.manpower_reporting_groups (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manpower_reporting_groups_name_not_blank
    check (length(trim(display_name)) > 0)
);

create index manpower_reporting_groups_name_idx
  on public.manpower_reporting_groups (display_name);

create trigger trg_manpower_reporting_groups_updated_at
before update on public.manpower_reporting_groups
for each row execute function public.set_manpower_updated_at();

alter table public.manpower_entries
  add column reporting_group_id uuid
  references public.manpower_reporting_groups(id) on delete restrict;

create index manpower_entries_reporting_group_date_idx
  on public.manpower_entries (reporting_group_id, work_date desc);

comment on table public.manpower_reporting_groups is
  'User-created organizational groups for entering and reviewing manpower rows; independent of Production jobs and temporary work labels.';

comment on column public.manpower_entries.reporting_group_id is
  'Organizational reporting group containing the labor entry; separate from its job or temporary work identity.';

alter table public.manpower_reporting_groups enable row level security;

create policy "Allow anon read manpower reporting groups"
  on public.manpower_reporting_groups for select to anon using (true);
create policy "Allow anon insert manpower reporting groups"
  on public.manpower_reporting_groups for insert to anon with check (true);
create policy "Allow anon update manpower reporting groups"
  on public.manpower_reporting_groups for update to anon using (true) with check (true);

-- Preserve each imported Monday group heading as a persistent reporting group.
insert into public.manpower_reporting_groups (display_name)
select distinct trim(e.unlisted_work_label)
from public.manpower_entries e
where e.entered_by = 'Monday import'
  and e.unlisted_work_label is not null
  and length(trim(e.unlisted_work_label)) > 0
  and not exists (
    select 1
    from public.manpower_reporting_groups existing
    where existing.display_name = trim(e.unlisted_work_label)
  );

-- The import stored the original Monday row Name in generated note metadata.
-- Restore that value as the temporary work label and remove only that metadata.
with corrected as (
  select
    e.id,
    g.id as reporting_group_id,
    substring(e.notes from E'\\[Monday label: ([^;]+); source row: [0-9]+\\]') as monday_row_label,
    nullif(
      trim(
        regexp_replace(
          coalesce(e.notes, ''),
          E'\\n?\\[Monday label: [^;]+; source row: [0-9]+\\]',
          '',
          'g'
        )
      ),
      ''
    ) as cleaned_notes
  from public.manpower_entries e
  join lateral (
    select candidate.id
    from public.manpower_reporting_groups candidate
    where candidate.display_name = trim(e.unlisted_work_label)
    order by candidate.created_at, candidate.id
    limit 1
  ) g on true
  where e.entered_by = 'Monday import'
)
update public.manpower_entries e
set reporting_group_id = corrected.reporting_group_id,
    job_id = null,
    unlisted_work_label = trim(corrected.monday_row_label),
    notes = corrected.cleaned_notes
from corrected
where e.id = corrected.id
  and corrected.monday_row_label is not null
  and length(trim(corrected.monday_row_label)) > 0;

commit;
