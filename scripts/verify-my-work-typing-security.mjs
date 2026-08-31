import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [authorization, inboxMigration, attachmentMigration, dialog] = await Promise.all([
  read("supabase/migrations/20260831_019_private_my_work_typing_broadcast.sql"),
  read("supabase/migrations/20260831_016_my_work_inbox.sql"),
  read("supabase/migrations/20260831_017_my_work_inbox_attachments.sql"),
  read("src/modules/my-work/InboxDialog.tsx"),
]);

assert.match(authorization, /create function public\.can_access_my_work_typing_topic\(p_topic text\)[\s\S]*security definer/);
assert.match(authorization, /from regexp_match\([\s\S]*'\^my-work-typing:/, "only a successfully parsed dedicated typing topic may reach UUID casts");
assert.match(authorization, /first_user_id <> second_user_id[\s\S]*first_user_id::text < second_user_id::text/, "topics must contain a distinct canonical participant pair");
assert.match(authorization, /auth\.uid\(\) in \(first_user_id, second_user_id\)/, "the caller must be one of the encoded participants");
assert.equal((authorization.match(/participant\.is_active/g) ?? []).length, 2, "both participants must be active");
assert.match(authorization, /revoke all on function public\.can_access_my_work_typing_topic\(text\) from public, anon, authenticated;/);
assert.match(authorization, /create policy my_work_typing_participant_receive[\s\S]*for select[\s\S]*to authenticated[\s\S]*extension = 'broadcast'[\s\S]*realtime\.topic\(\)/);
assert.match(authorization, /create policy my_work_typing_participant_publish[\s\S]*for insert[\s\S]*to authenticated[\s\S]*extension = 'broadcast'[\s\S]*realtime\.topic\(\)/);
assert.doesNotMatch(authorization, /to (public|anon)|service_role|alter table public\.my_work_messages|my_work_message_attachments/, "typing authorization must not broaden roles or alter persisted Inbox privacy");

assert.match(dialog, /supabase\.auth\.getSession\(\)[\s\S]*supabase\.realtime\.setAuth\(session\.access_token\)/, "Realtime must authenticate before subscribing");
assert.match(dialog, /my-work-typing:\$\{topic\}[\s\S]*config:\{private:true,broadcast:\{self:false\}\}/, "typing must use a private conversation-specific channel");
assert.match(dialog, /if\(!typingPeerId\|\|!currentUserId\)return/, "only an active direct conversation may subscribe");
assert.match(dialog, /typing:false[\s\S]*removeChannel\(channel\)/, "typing state must clear and unsubscribe on cleanup");

const participantA = "11111111-1111-4111-8111-111111111111";
const participantB = "22222222-2222-4222-8222-222222222222";
const unrelatedC = "33333333-3333-4333-8333-333333333333";
const topic = `my-work-typing:${participantA}:${participantB}`;
const activeUsers = new Set([participantA, participantB, unrelatedC]);
const mayAccess = ({ userId, isAuthenticated = true, users = activeUsers, candidateTopic = topic }) => {
  if (!isAuthenticated || !userId) return false;
  const match = candidateTopic.match(/^my-work-typing:([0-9a-f-]{36}):([0-9a-f-]{36})$/);
  if (!match) return false;
  const [, first, second] = match;
  return first !== second && first < second && (userId === first || userId === second) && users.has(first) && users.has(second) && users.has(userId);
};

assert.equal(mayAccess({ userId: participantA }), true, "participant A may subscribe and publish");
assert.equal(mayAccess({ userId: participantB }), true, "participant B may subscribe, receive, and publish");
assert.equal(mayAccess({ userId: unrelatedC }), false, "unrelated authenticated user C may not subscribe, read, or publish");
assert.equal(mayAccess({ userId: null, isAuthenticated: false }), false, "anon may not subscribe");
assert.equal(mayAccess({ userId: participantA, users: new Set([participantB, unrelatedC]) }), false, "an inactive caller may not participate");
assert.equal(mayAccess({ userId: participantB, users: new Set([participantB, unrelatedC]) }), false, "a conversation with an inactive participant is denied");

assert.match(inboxMigration, /my_work_messages_participant_select[\s\S]*sender_user_id=auth\.uid\(\) or recipient_user_id=auth\.uid\(\)/, "ordinary Inbox messages remain participant-private");
assert.match(attachmentMigration, /my_work_message_attachments_participant_select[\s\S]*message\.sender_user_id=auth\.uid\(\) or \(message\.recipient_user_id=auth\.uid\(\) and message\.delivery_status='ready'\)/, "ordinary Inbox attachments remain participant-private");

console.log("Private My Work typing-channel security checks passed.");
