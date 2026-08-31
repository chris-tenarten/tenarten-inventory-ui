import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const[migration,inboxMigration,inboxAttachmentMigration,taskMigration,taskAttachmentMigration,inboxApi,taskApi,dialog,page]=await Promise.all([
  read("supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql"),
  read("supabase/migrations/20260831_016_my_work_inbox.sql"),
  read("supabase/migrations/20260831_017_my_work_inbox_attachments.sql"),
  read("supabase/migrations/20260827_012_my_work_mvp.sql"),
  read("supabase/migrations/20260831_015_my_work_task_attachments.sql"),
  read("src/modules/my-work/inbox.ts"),
  read("src/modules/my-work/queries.ts"),
  read("src/modules/my-work/InboxDialog.tsx"),
  read("src/modules/my-work/MyWorkPage.tsx"),
]);

assert.match(migration,/add column edited_at timestamptz[\s\S]*edit_count integer not null default 0/);
assert.match(migration,/create table public\.my_work_message_versions[\s\S]*prior_body text not null[\s\S]*editor_user_id uuid not null[\s\S]*edited_at timestamptz/);
assert.match(migration,/unique\(message_id, version_number\)/,"message versions must have immutable order identity");
assert.match(migration,/my_work_message_versions_participant_select[\s\S]*message\.sender_user_id=auth\.uid\(\) or message\.recipient_user_id=auth\.uid\(\)/,"history must retain participant privacy");
assert.doesNotMatch(migration.match(/create policy my_work_message_versions_participant_select[\s\S]*?\);/)?.[0]??"",/role='admin'|has_app_capability/,"history must not add an Admin content-reading bypass");
assert.match(migration,/edit_my_work_inbox_message[\s\S]*sender_kind<>'user'[\s\S]*sender_user_id<>actor\.user_id[\s\S]*insert into public\.my_work_message_versions[\s\S]*set body=btrim\(p_body\),edited_at=changed_at,edit_count=edit_count\+1/);
assert.match(migration,/TenOps system messages cannot be edited/);
assert.match(migration,/list_my_work_inbox_messages_v2[\s\S]*recipient\.display_name[\s\S]*message\.edited_at/);

assert.match(migration,/list_my_work_inbox_recipients[\s\S]*candidate\.display_name[\s\S]*candidate\.is_active[\s\S]*candidate\.role<>'developer' or actor\.role='admin'/,"recipient identities must be canonical, active, and hide Developers from non-Admins");
assert.doesNotMatch(inboxApi,/operationalFirstName|split\(/,"Inbox account names must not be shortened client-side");
assert.doesNotMatch(taskApi,/loadJobUpdateCollaborators|operationalFirstName/,"My Work's reused Inbox candidate list must retain canonical full names");

assert.match(migration,/prepare_admin_delete_my_work_message[\s\S]*role='admin'[\s\S]*sender_kind='system'[\s\S]*my_work_message_attachments/);
assert.match(migration,/admin_permanently_delete_my_work_message[\s\S]*role='admin'[\s\S]*PERMANENTLY_DELETE_MESSAGE[\s\S]*storage\.objects[\s\S]*my_work_message_deletion_audit[\s\S]*delete from public\.account_notifications[\s\S]*delete from public\.my_work_messages/);
assert.match(migration,/create table public\.my_work_message_deletion_audit[\s\S]*deleted_message_id[\s\S]*actor_user_id[\s\S]*original_sender_user_id[\s\S]*original_recipient_user_id[\s\S]*attachment_count/);
assert.doesNotMatch(migration.match(/create table public\.my_work_message_deletion_audit[\s\S]*?\);/)?.[0]??"",/body|title|notes/,"message deletion audit must not retain content");
assert.match(inboxApi,/prepare_admin_delete_my_work_message[\s\S]*storage\.from\(INBOX_ATTACHMENT_BUCKET\)\.remove\(paths\)[\s\S]*admin_permanently_delete_my_work_message/,"Storage cleanup must precede permanent message deletion");
assert.match(dialog,/senderUserId===currentUserId[\s\S]*Edit message/,"only sent messages expose the normal edit action");
assert.match(dialog,/auth\.profile\?\.role==="admin"[\s\S]*Permanently delete message/);
assert.match(dialog,/Permanently delete this message\?[\s\S]*cannot be undone/i);
assert.match(dialog,/message\.editedAt\?<span>· Edited<\/span>/);
assert.match(dialog,/textarea autoFocus value=\{editBody\}[\s\S]*Cancel[\s\S]*Save/);

assert.match(migration,/prepare_admin_delete_work_task[\s\S]*role='admin'[\s\S]*work_task_attachments/);
assert.match(migration,/admin_permanently_delete_work_task[\s\S]*role='admin'[\s\S]*PERMANENTLY_DELETE_TASK[\s\S]*storage\.objects[\s\S]*work_task_deletion_audit[\s\S]*delete from public\.account_notifications[\s\S]*delete from public\.work_tasks/);
assert.match(migration,/create table public\.work_task_deletion_audit[\s\S]*deleted_task_id[\s\S]*actor_user_id[\s\S]*original_creator_user_id[\s\S]*original_visibility[\s\S]*attachment_count[\s\S]*preference_count[\s\S]*notification_count/);
assert.doesNotMatch(migration.match(/create table public\.work_task_deletion_audit[\s\S]*?\);/)?.[0]??"",/title|notes|body/,"task deletion audit must not retain private task content");
assert.match(taskApi,/prepare_admin_delete_work_task[\s\S]*storage\.from\(ATTACHMENT_BUCKET\)\.remove\(paths\)[\s\S]*admin_permanently_delete_work_task/);
assert.match(page,/auth\.profile\?\.role==="admin"[\s\S]*Admin cleanup[\s\S]*Permanently delete task/);
assert.match(page,/Permanently delete this task\?[\s\S]*cannot be undone/i);

assert.match(inboxAttachmentMigration,/message_id uuid not null references public\.my_work_messages\(id\) on delete cascade/,"message attachment metadata must cascade only with its message");
assert.match(taskAttachmentMigration,/task_id uuid not null references public\.work_tasks\(id\) on delete cascade/,"task attachment metadata must cascade only with its task");
assert.match(taskMigration,/context_id uuid/,"task context must remain a reference value, not a cascade target");
assert.doesNotMatch(migration,/delete from public\.jobs|delete from public\.app_users|delete from auth\.users|create table public\.[a-z_]*conversation/,"cleanup must not delete canonical records or introduce a conversation table");
assert.match(inboxMigration,/my_work_messages_participant_select[\s\S]*sender_user_id=auth\.uid\(\) or recipient_user_id=auth\.uid\(\)/,"ordinary message privacy must remain unchanged");

console.log("My Work Inbox lifecycle and Admin cleanup checks passed.");
