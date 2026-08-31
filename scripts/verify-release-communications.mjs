import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, delivery, notifications, inboxDialog, inboxClient, inboxBase, inboxAttachments, myWork] = await Promise.all([
  read('supabase/migrations/20260831_018_durable_release_communications.sql'),
  read('scripts/deliver-tenops-release-communication.mjs'),
  read('src/components/AccountNotifications.tsx'),
  read('src/modules/my-work/InboxDialog.tsx'),
  read('src/modules/my-work/inbox.ts'),
  read('supabase/migrations/20260831_016_my_work_inbox.sql'),
  read('supabase/migrations/20260831_017_my_work_inbox_attachments.sql'),
  read('src/modules/my-work/MyWorkPage.tsx'),
]);

assert.match(migration, /create table public\.tenops_release_communications/);
assert.match(migration, /communication_key text primary key/);
assert.match(migration, /'my_work_v1_announcement','account_notification','My Work has been updated'/);
assert.match(migration, /My Work now includes Today, task attachments, improved Shared Tasks, grouping, mobile improvements, and other workspace refinements\./);
assert.match(migration, /'inbox_onboarding_v1','system_inbox','Welcome to Inbox'/);
assert.match(migration, /Inbox is for direct communication with another TenOps user\./);
assert.match(migration, /Use Shared Tasks when you need someone to take action\./);
assert.match(migration, /Use @mentions to draw attention to an existing Job Update or other TenOps context\./);
assert.match(migration, /Messages are private between participants/);

assert.match(migration, /alter column sender_user_id drop not null/);
assert.match(migration, /sender_kind text not null default 'user'/);
assert.match(migration, /sender_kind='system' and sender_user_id is null and system_sender_key='tenops'/);
assert.match(migration, /my_work_messages_system_delivery_unique[\s\S]*recipient_user_id,system_message_key/);
assert.match(migration, /case when message\.sender_kind='system' then 'TenOps'/);
assert.match(migration, /00000000-0000-0000-0000-000000000001/);
assert.match(inboxClient, /TENOPS_SYSTEM_INBOX_USER_ID/);
assert.match(inboxDialog, /isSystem\?"TenOps"/);
assert.match(inboxDialog, /TenOps system messages are read-only\./);
assert.match(inboxDialog, /selected\?\.isSystem\?/);

assert.match(migration, /'system-announcement:'\|\|communication\.communication_key/);
assert.match(migration, /'feature_announcement'/);
assert.match(migration, /'destination',communication\.destination/);
assert.match(notifications, /notification_type === "feature_announcement" && item\.metadata\.destination\?\.startsWith\("\/"\)[\s\S]*!item\.metadata\.destination\.startsWith\("\/\/"\)/,'registered announcements must support safe same-origin destinations without another UI change');
assert.match(migration, /on conflict\(user_id,notification_key\) do nothing/);
assert.match(migration, /on conflict\(recipient_user_id,system_message_key\)[\s\S]*do nothing/);
assert.doesNotMatch(migration, /update public\.(work_tasks|account_notifications)[\s\S]*set/i, 'release delivery must not rewrite existing tasks or notification history');
assert.doesNotMatch(migration, /delete from public\.(work_tasks|my_work_messages|account_notifications)/i);

assert.match(migration, /deliver_to_future_users boolean not null default false/);
assert.match(migration, /'inbox_onboarding_v1'[\s\S]*'\/my-work\?inbox=1',true/);
assert.match(migration, /after insert or update of is_active on public\.app_users/);
assert.match(migration, /new\.is_active and \(tg_op='INSERT' or not old\.is_active\)/);
assert.match(migration, /where is_active and deliver_to_future_users/);

assert.match(migration, /revoke all on function public\.deliver_tenops_release_communication\(text\) from public,anon,authenticated/);
assert.match(migration, /grant execute on function public\.deliver_tenops_release_communication\(text\) to service_role/);
assert.match(inboxBase, /values\(message_id,actor\.user_id,recipient\.user_id/,'ordinary Inbox sends must derive sender identity from auth');
assert.match(inboxAttachments, /where id=p_message_id and sender_user_id=auth\.uid\(\) and delivery_status='draft'/);
assert.match(inboxBase, /my_work_messages_participant_select[\s\S]*sender_user_id=auth\.uid\(\) or recipient_user_id=auth\.uid\(\)/);
assert.doesNotMatch(inboxBase, /role='admin'[\s\S]*my_work_messages/,'normal Inbox privacy must not gain an Admin content bypass');

assert.match(migration, /insert into public\.my_work_messages\(sender_user_id,recipient_user_id,body,read_at,delivery_status,sender_kind,system_sender_key,system_message_key\)[\s\S]*values\(null,p_user_id,communication\.body,null,'ready','system','tenops',communication\.communication_key\)/,'system onboarding must begin unread and ready');
assert.match(migration, /sender_kind='system' and recipient_user_id=auth\.uid\(\) and read_at is null/);
assert.match(inboxBase, /recipient_user_id=auth\.uid\(\) and read_at is null/);
assert.match(myWork, /loadInboxMessages\(\)[\s\S]*!message\.readAt/,'Inbox unread badges must derive from persisted message read state');
assert.match(notifications, /mark_my_account_notification_read/);
assert.match(notifications, /item\.read_at === null/);

assert.match(delivery, /--key/);
assert.match(delivery, /TENOPS_RELEASE_DELIVERY_CONFIRM/);
assert.match(delivery, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(delivery, /deliver_tenops_release_communication/);
assert.doesNotMatch(delivery, /\.from\([^)]*\)\.(insert|update|delete|upsert)/,'release script must use only the guarded delivery RPC');

console.log('Durable release communication checks passed.');
