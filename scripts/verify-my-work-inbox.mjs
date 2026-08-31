import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, attachments, dialog, inbox, page, notifications, arrival, tasks, activity, theme, nav, attachmentInput] = await Promise.all([
  read("supabase/migrations/20260831_016_my_work_inbox.sql"),
  read("supabase/migrations/20260831_017_my_work_inbox_attachments.sql"),
  read("src/modules/my-work/InboxDialog.tsx"),
  read("src/modules/my-work/inbox.ts"),
  read("src/modules/my-work/MyWorkPage.tsx"),
  read("src/components/AccountNotifications.tsx"),
  read("src/components/notification-arrival-state.ts"),
  read("supabase/migrations/20260827_012_my_work_mvp.sql"),
  read("src/modules/production/components/ActivityStrip.tsx"),
  read("src/app/globals.css"),
  read("src/app/client-layout-shell.tsx"),
  read("src/modules/my-work/AttachmentFileInput.tsx"),
]);

assert.match(migration, /create table public\.my_work_messages/);
assert.match(migration, /create function public\.list_my_work_inbox_recipients\(\)[\s\S]*candidate\.display_name/);
assert.match(migration, /sender_user_id uuid not null references public\.app_users/);
assert.match(migration, /recipient_user_id uuid not null references public\.app_users/);
assert.match(migration, /job_id uuid references public\.jobs\(id\) on delete set null/);
assert.match(migration, /my_work_messages_participant_select[\s\S]*sender_user_id=auth\.uid\(\) or recipient_user_id=auth\.uid\(\)/, "RLS must expose messages only to participants without an Admin bypass");
assert.doesNotMatch(migration, /has_app_capability|role='admin'|role = 'admin'/, "private messaging must not have a capability or Admin content bypass");
assert.match(migration, /revoke all on public\.my_work_messages from public,anon,authenticated;[\s\S]*grant select on public\.my_work_messages to authenticated/, "clients must not write messages directly");
assert.match(migration, /sender_user_id,recipient_user_id,body,job_id\)[\s\S]*actor\.user_id,recipient\.user_id/, "sender identity must come from auth.uid(), not client input");
assert.match(migration, /notification_type,title,body,metadata\)[\s\S]*'inbox_message'[\s\S]*'Open Inbox to read it\.'/s, "notification must avoid exposing the message body");
assert.match(migration, /update public\.my_work_messages set read_at=clock_timestamp\(\)[\s\S]*recipient_user_id=auth\.uid\(\) and read_at is null/);
assert.match(migration, /alter publication supabase_realtime add table public\.my_work_messages/);
assert.match(attachments, /create table public\.my_work_message_attachments/);
assert.match(attachments, /'my-work-inbox-attachments','my-work-inbox-attachments',false/);
assert.match(attachments, /my_work_message_attachments_participant_select[\s\S]*message\.sender_user_id=auth\.uid\(\) or \(message\.recipient_user_id=auth\.uid\(\) and message\.delivery_status='ready'\)/, "attachment metadata must remain participant-private without an Admin bypass");
assert.match(attachments, /my_work_inbox_attachment_object_select[\s\S]*message\.sender_user_id=auth\.uid\(\) or \(message\.recipient_user_id=auth\.uid\(\) and message\.delivery_status='ready'\)/, "private Storage objects must use the message participant boundary");
assert.doesNotMatch(attachments, /has_app_capability|role='admin'|role = 'admin'/);
assert.match(attachments, /delivery_status text not null default 'ready'/);
assert.match(attachments, /create_my_work_inbox_message_draft[\s\S]*delivery_status\)[\s\S]*'draft'/);
assert.match(attachments, /finalize_my_work_inbox_message[\s\S]*attachment_count<>p_expected_attachment_count[\s\S]*delivery_status='ready'[\s\S]*'inbox_message'/, "notification must follow complete attachment association");
assert.match(attachments, /discard_my_work_inbox_message_draft/);
assert.match(dialog, /md:grid-cols-\[310px_minmax\(0,1fr\)\]/);
assert.match(dialog, /Back to conversations/);
assert.match(dialog, /New message/);
assert.match(dialog, /Select a recipient to start a conversation\./);
assert.match(dialog, /Link a Job/);
assert.match(dialog, /Reference the Job this message is about\./);
assert.doesNotMatch(dialog, />No Job context</);
assert.match(dialog, /openProductionJob\(message\.jobId\)/);
assert.match(dialog, /recipient_user_id=eq\.\$\{currentUserId\}/);
assert.match(dialog, /sender_user_id=eq\.\$\{currentUserId\}/);
assert.match(dialog, /event:"UPDATE"[\s\S]*recipient_user_id=eq\.\$\{currentUserId\}/);
assert.match(dialog, /removeChannel\(channel\)/);
assert.match(dialog, /event\.key!=="Escape"/);
assert.match(dialog, /event\.key==="Enter"&&!event\.shiftKey/);
assert.match(dialog, /<AttachmentFileInput/);
assert.match(attachmentInput, /type="file" multiple accept=\{attachmentAccept\}/);
assert.match(attachmentInput, /new File\(\[await file\.arrayBuffer\(\)\]/);
assert.match(attachmentInput, /onFiles\(owned\)[\s\S]*finally[\s\S]*input\.value=""/, "camera files must be owned by application state before the native input resets");
assert.match(dialog, /sendInboxMessageWithAttachments/);
assert.match(dialog, /AttachmentView/);
assert.match(dialog, /preview\?\.previewUrl/);
assert.match(dialog, /pb-\[max\(\.75rem,env\(safe-area-inset-bottom\)\)\]/);
assert.doesNotMatch(dialog, /reaction|delivered|read receipt/i);
assert.match(dialog, /my-work-typing:\$\{topic\}/);
assert.match(dialog, /supabase\.realtime\.setAuth\(session\.access_token\)/);
assert.match(dialog, /config:\{private:true,broadcast:\{self:false\}\}/);
assert.match(dialog, /type:"broadcast",event:"typing"/);
assert.match(dialog, /now-lastTypingBroadcastRef\.current>=1000/);
assert.match(dialog, /window\.setTimeout\(\(\)=>\{broadcastTyping\(false\)[\s\S]*1300\)/);
assert.match(dialog, /window\.setTimeout\(\(\)=>setRemoteTypingUserId\(""\),2600\)/);
assert.match(dialog, /typing:false[\s\S]*removeChannel\(channel\)/, "typing state must clear and unsubscribe when the direct conversation closes");
assert.match(dialog, /\$\{selected\.name\} is typing…/);
assert.doesNotMatch(inbox, /typing/, "typing state must remain ephemeral and outside persisted Inbox queries");
assert.match(inbox, /list_my_work_inbox_messages/);
assert.match(inbox, /send_my_work_inbox_message/);
assert.match(inbox, /create_my_work_inbox_message_draft/);
assert.match(inbox, /finalize_my_work_inbox_message/);
assert.match(inbox, /discard_my_work_inbox_message_draft/);
assert.match(inbox, /createSignedUrl/);
assert.match(inbox, /mark_my_work_inbox_conversation_read/);
assert.match(page, /<InboxIcon[\s\S]*Inbox/);
assert.match(page, /<ToolboxLauncher \/>/);
assert.match(page, /data-inbox-rail/);
assert.match(page, /hidden h-\[calc\(100dvh-65px\)\][\s\S]*min-\[1440px\]:flex/);
assert.match(page, /expanded\?"w-72":"w-14"/);
assert.match(page, /aria-label=\{expanded\?"Collapse Inbox rail":"Expand Inbox rail"\}[\s\S]*tenops-selected-surface/,'the rail header must use the established high-contrast selected surface in both themes');
assert.match(page, /min-\[1440px\]:hidden/,'mobile and intermediate widths must retain the header Inbox button until the rail can coexist with the full task workspace');
assert.match(page, /data-my-work className="flex w-full items-start"/,'the rail must remain pinned to the viewport-side edge instead of a centered outer wrapper');
assert.match(page, /mx-auto min-w-0 w-full max-w-\[1120px\] flex-1/,'only the established-width task workspace should center in the space remaining beside the rail');
assert.match(page, /onOpenConversation=\{\(userId\)=>[\s\S]*setInboxOpen\(true\)/,'rail conversation selection must open the existing centered Inbox');
assert.match(page, /onNewMessage=\{\(\)=>[\s\S]*setInboxComposeNew\(true\)/);
assert.match(page, /inboxUnreadCount/);
assert.match(page, /inboxUnreadCount>9\?"9\+"/);
assert.match(page, /absolute -right-1 -top-1[\s\S]*bg-red-600/);
assert.match(page, /my-work-inbox-badge[\s\S]*event:"UPDATE"/);
assert.match(page, /const nextTasks = await loadMyWorkTasks\(\);[\s\S]*setTasks\(\(current\)=>/, "tasks must render without waiting for secondary My Work or Inbox metadata");
assert.match(page, /loadWorkCollaborators\(\),loadWorkJobs\(\),refreshAttachmentCounts\(\)/);
assert.match(page, /setInboxRecipients\(others\)/, "Inbox must reuse the canonical collaborator lookup");
assert.match(page, /loadInboxUnreadCount\(auth\.profile\.userId\)/, "Inbox badge must use a recipient-scoped narrow count instead of loading message history");
assert.match(inbox, /loadInboxAttachments\(messageIds/);
assert.match(inbox, /createInboxAttachmentUrl/);
assert.doesNotMatch(inbox.match(/export async function loadInboxMessages[\s\S]*?\n\}/)?.[0]??"", /createSignedUrl/, "Inbox list loading must not sign attachment URLs");
assert.match(page, /inboxUserId/);
assert.match(nav, /href: '\/my-work\?inbox=1', label: 'Inbox'/);
assert.match(nav, /item\.href==='\/my-work\?inbox=1'[\s\S]*tenops:open-inbox/,'the submenu must open Inbox immediately when My Work is already mounted');
assert.match(page, /params\.get\("inbox"\) === "1"[\s\S]*setInboxOpen\(true\)[\s\S]*params\.delete\("inbox"\)/,'the Inbox submenu URL must open the existing Inbox surface after navigation');
assert.match(notifications, /notification_type === "inbox_message"[\s\S]*\/my-work\?inboxUserId=/);
assert.match(notifications, /tenops:open-inbox/);
assert.match(page, /addEventListener\("tenops:open-inbox"/);
assert.match(arrival, /"inbox_message"/);
assert.match(tasks, /work_tasks_participant_select/);
assert.match(page, /Assigned to \$\{participantName\(task\.assigneeName\)\}/);
assert.match(page, /From \$\{participantName\(task\.creatorName\)\}/);
assert.match(activity, /\/my-work\?newTask=1&newTaskJobId=/);
assert.match(theme, /\.bg-slate-50\\\/60/);

console.log("My Work Inbox V1.1 checks passed.");
