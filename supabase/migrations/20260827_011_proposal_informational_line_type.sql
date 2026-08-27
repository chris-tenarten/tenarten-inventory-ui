-- Allow Proposal freight-responsibility rows to remain descriptive and unpriced.
begin;

alter table public.proposal_lines
  drop constraint if exists proposal_lines_line_type_check;

alter table public.proposal_lines
  add constraint proposal_lines_line_type_check
  check (line_type in ('product','charge','informational','included'));

commit;
