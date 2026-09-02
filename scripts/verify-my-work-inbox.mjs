import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, attachments, dialog, inbox, page, notifications, arrival, tasks, activity, theme, nav, attachmentInput, globalMessaging] = await Promise.all([
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
  read("src/components/GlobalMessaging.tsx"),
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
assert.match(inbox, /list_my_work_inbox_messages_v2/);
assert.match(inbox, /editedAt/);
assert.match(inbox, /send_my_work_inbox_message/);
assert.match(inbox, /create_my_work_inbox_message_draft/);
assert.match(inbox, /finalize_my_work_inbox_message/);
assert.match(inbox, /discard_my_work_inbox_message_draft/);
assert.match(inbox, /createSignedUrl/);
assert.match(inbox, /mark_my_work_inbox_conversation_read/);
assert.match(page, /<ToolboxLauncher \/>/);
assert.doesNotMatch(page, /data-inbox-rail|InboxIcon|inboxUnreadCount|<InboxDialog/,'My Work must no longer expose or mount a second Inbox presentation');
assert.match(page, /const \{tasks:nextTasks,groups:nextGroups\} = await loadMyWorkOverview\(\);[\s\S]*setTasks\(\(current\)=>/, "tasks and their lightweight personal groups must render without waiting for secondary My Work or Inbox metadata");
assert.match(page, /loadWorkCollaborators\(\),loadWorkJobs\(\),refreshAttachmentCounts\(\)/);
assert.match(inbox, /loadInboxAttachments\(messageIds/);
assert.match(inbox, /createInboxAttachmentUrl/);
assert.doesNotMatch(inbox.match(/export async function loadInboxMessages[\s\S]*?\n\}/)?.[0]??"", /createSignedUrl/, "Inbox list loading must not sign attachment URLs");
assert.match(globalMessaging, /aria-label="Messaging"[\s\S]*<Send/);
assert.match(globalMessaging, /loadInboxUnreadCount\(userId\)/, "global badge must use the canonical recipient-scoped narrow count");
assert.match(globalMessaging, /bg-red-600[\s\S]*unreadCount/);
assert.match(globalMessaging, /dynamic\(\(\) => import\("@\/modules\/my-work\/InboxDialog"\)/, "the full Inbox workspace must be lazy loaded");
assert.match(globalMessaging, /const prepareWorkspace=[\s\S]*loadWorkJobs\(\)/, "full Inbox supporting data must load only when a full Messaging workspace opens");
assert.match(inbox, /loadRecentInboxMessages[\s\S]*\.limit\(limit\)/, "recent awareness must use a bounded metadata query");
assert.doesNotMatch(globalMessaging, /loadInboxMessages/, "the header dropdown and compact sidebar must not load full conversation history");
assert.match(globalMessaging, /addEventListener\("tenops:open-inbox"/);
assert.match(globalMessaging, /params\.get\("inbox"\)[\s\S]*params\.get\("inboxUserId"\)[\s\S]*history\.replaceState/,'dedicated Inbox deep links must remain functional without route navigation');
assert.match(globalMessaging, /global-messaging-badge:[\s\S]*event:\s*"UPDATE"/);
assert.match(globalMessaging, /onMouseEnter=\{showMenu\}[\s\S]*aria-label="Open Messaging menu"/, "recent-message menu must support hover and a click-accessible control");
assert.match(globalMessaging, /role="switch" aria-checked=\{sidebarOpen\}[\s\S]*Message sidebar[\s\S]*data-global-message-sidebar/);
assert.match(globalMessaging, /headerPortalTarget&&sidebarOpen&&!sidebarExpanded[\s\S]*onClick=\{expandSidebar\}[\s\S]*<Send[\s\S]*createPortal\(<aside data-global-message-sidebar data-expanded="false"/, "the compact rail header must move with the sticky shell header while its body remains fixed behind it");
assert.match(globalMessaging, /data-global-message-sidebar data-expanded="false"[\s\S]*fixed inset-y-0 left-0 z-\[90\]/, "the rail body must extend behind the elastically moving header segment so overscroll cannot expose a gap");
assert.match(globalMessaging, /presentation=\{sidebarExpanded\?"sidepane":"dialog"\}/, "sidebar expansion and header shortcut must select distinct full-workspace presentations");
assert.match(dialog, /presentation\?:"dialog"\|"sidepane"[\s\S]*sidepane\?"items-stretch justify-start"/, "expanded Messaging must reuse the canonical Inbox as a left sidepane");
assert.match(theme, /@media \(min-width: 768px\) \{[\s\S]*data-global-message-sidebar\]\[data-expanded="false"\]\) \[data-app-shell\] > header,[\s\S]*\[data-app-shell\] > main \{[\s\S]*width: calc\(100% - 3\.5rem\);[\s\S]*margin-left: 3\.5rem/, "the header and page must both compact at the same breakpoint where the persistent rail becomes visible");
assert.doesNotMatch(globalMessaging, /presentation="sidecar"/);
assert.match(dialog, /sidepane\?"items-stretch justify-start":"items-center justify-center sm:p-4"/, "full Messaging must retain the established centered modal while supporting the left sidepane");
assert.doesNotMatch(nav, /href: '\/my-work\?inbox=1', label: 'Inbox'/);
assert.match(nav, /<GlobalMessaging key=\{auth\.profile\?\.userId\?\?'signed-out'\} \/>[\s\S]*<AccountNotifications/,'identity-scoped Messaging must appear immediately before Notifications');
assert.match(nav, /data-shell-header[\s\S]*sticky top-0 z-\[100\]/,'the global header must remain above page-level sticky surfaces');
assert.doesNotMatch(nav, /data-shell-header[\s\S]{0,400}backdrop-blur/,'the momentum-scrolled sticky header must not depend on a backdrop-filter compositing layer');
assert.match(nav, /data-shell-header-inner[\s\S]*relative z-10/,'header branding, navigation, notifications, and profile must remain above the header surface');
assert.match(theme, /html\[data-appearance="dark"\] \[data-app-shell\] > header \{\s*background: #171c24 !important;/,'the dark header must use an opaque non-filtered surface');
assert.match(theme, /@media \(max-width: 767px\)[\s\S]*\[data-shell-header\]\[data-dev-branding="true"\]:not\(\[data-compact-header="true"\]\) \[data-shell-brand-subtitle\]/,'the retained mobile subtitle sizing must remain scoped to TenDev branding');
assert.doesNotMatch(notifications, /notification_type === "inbox_message"[\s\S]{0,500}router\.push\(`\/my-work\?inboxUserId=/,'Inbox notifications must not navigate away from the current route');
assert.match(notifications, /tenops:open-inbox/);
assert.match(arrival, /"inbox_message"/);
assert.match(tasks, /work_tasks_participant_select/);
assert.match(page, /Assigned to \$\{participantName\(task\.assigneeName\)\}/);
assert.match(page, /From \$\{participantName\(task\.creatorName\)\}/);
assert.match(activity, /\/my-work\?newTask=1&newTaskJobId=/);
assert.match(theme, /\.bg-slate-50\\\/60/);

console.log("Global Messaging / canonical Inbox checks passed.");
