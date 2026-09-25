-- Operator-owned evidence/phase gate. No user content. Run before pause.
begin;
create table if not exists public.messaging_attachment_release(
 singleton boolean primary key default true check(singleton),
 phase text not null check(phase in ('prepared','paused','barrier','migrated','open')),
 client_sha text, deployment_id text, refreshed_verified boolean not null default false
);
alter table public.messaging_attachment_release enable row level security;
revoke all on public.messaging_attachment_release from public,anon,authenticated,service_role;
insert into public.messaging_attachment_release(singleton,phase) values(true,'prepared') on conflict do nothing;
commit;
