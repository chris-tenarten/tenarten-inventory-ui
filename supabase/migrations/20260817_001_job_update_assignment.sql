begin;

alter table public.job_updates
  add column follow_up_assignee_name text;

comment on column public.job_updates.follow_up_assignee_name is
  'Display-name snapshot of the one person expected to resolve a needs-attention Job Update. A future authenticated-user reference may supplement this field.';

commit;
