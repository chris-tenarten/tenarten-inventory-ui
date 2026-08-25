-- One retained, non-interruptive announcement for active accounts at the
-- Production Dark Mode release boundary. Additive and safe to rerun.

begin;

insert into public.account_notifications(
  user_id,
  notification_key,
  notification_type,
  title,
  body,
  metadata
)
select
  users.user_id,
  'account-production-dark-mode-v1',
  'appearance_available',
  'Dark Mode is now available',
  'TenOps now supports Light and Dark appearance. Choose your preference in Settings.',
  jsonb_build_object('purpose', 'appearance', 'destination', '/settings#appearance')
from public.app_users users
where users.is_active
on conflict (user_id, notification_key) do nothing;

commit;
