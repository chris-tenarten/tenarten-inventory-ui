import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
async function verify(){
const[migration,enrichment,page,queries,notifications,arrival,inspector,nav,theme,hero]=await Promise.all([
 read('supabase/migrations/20260827_012_my_work_mvp.sql'),read('supabase/migrations/20260828_013_my_work_enrichment.sql'),read('src/modules/my-work/MyWorkPage.tsx'),read('src/modules/my-work/queries.ts'),read('src/components/AccountNotifications.tsx'),read('src/components/notification-arrival-state.ts'),read('src/modules/production/components/ProductionJobInspector.tsx'),read('src/app/client-layout-shell.tsx'),read('src/app/globals.css'),read('src/components/WelcomeHero.tsx'),
]);

assert.match(migration,/visibility text not null check \(visibility in \('private','shared'\)\)/);
assert.match(migration,/work_tasks_private_owner check \(visibility = 'shared' or creator_user_id = assignee_user_id\)/);
assert.match(migration,/work_tasks_shared_participants check \(visibility = 'private' or creator_user_id <> assignee_user_id\)/);
assert.match(migration,/create policy work_tasks_participant_select[\s\S]*assignee_user_id=auth\.uid\(\) or \(visibility='shared' and creator_user_id=auth\.uid\(\)\)/,'RLS must expose private tasks only to their owner and shared tasks only to participants');
assert.match(migration,/revoke all on public\.work_tasks from public,anon,authenticated;[\s\S]*grant select on public\.work_tasks to authenticated/,'clients may read participant-scoped rows but must mutate through guarded RPCs');
assert.match(migration,/where exists\(select 1 from public\.app_users actor where actor\.user_id=auth\.uid\(\) and actor\.is_active\)[\s\S]*t\.assignee_user_id=auth\.uid\(\) or \(t\.visibility='shared' and t\.creator_user_id=auth\.uid\(\)\)/,'task list RPC must repeat the participant boundary');
assert.match(migration,/if p_assignee_user_id is null or p_assignee_user_id=auth\.uid\(\)[\s\S]*task_visibility:='private'/);
assert.match(migration,/task_visibility:='shared'/);
assert.match(migration,/shared-task-assigned:[\s\S]*shared_task_assigned/);
assert.match(migration,/shared-task-completed:[\s\S]*shared_task_completed/);
assert.match(migration,/task\.creator_user_id<>auth\.uid\(\)/,'private/self completion must not notify the actor');
assert.match(migration,/context_type text[\s\S]*context_id uuid[\s\S]*context_type is null or context_type = 'job'/,'context pair must be extensible while only Job is accepted today');
assert.match(enrichment,/alter table public\.work_tasks add column notes text not null default ''/);
assert.match(enrichment,/create table public\.work_task_preferences/);
assert.match(enrichment,/primary key \(task_id,user_id\)/,'task color must be user-specific');
assert.match(enrichment,/work_task_preferences_self_select[\s\S]*user_id=auth\.uid\(\)[\s\S]*task\.assignee_user_id=auth\.uid\(\) or \(task\.visibility='shared' and task\.creator_user_id=auth\.uid\(\)\)/,'task preferences must remain self-owned and participant-scoped');
assert.match(enrichment,/left join public\.work_task_preferences preference on preference\.task_id=t\.id and preference\.user_id=auth\.uid\(\)/);
assert.match(enrichment,/create function public\.update_my_work_task/);
assert.match(enrichment,/Only the task creator can change sharing/);
assert.match(enrichment,/shared-task-assigned:/,'reassignment must preserve assignment notification behavior');
assert.match(page,/placeholder="What needs to get done\?"/);assert.match(page,/event\.key === "Enter"/);assert.match(page,/Your tasks, all in one place\./);assert.match(page,/All Tasks/);assert.match(page,/My Tasks/);assert.match(page,/Shared Tasks/);assert.match(page,/<Handshake/);assert.match(page,/h-\[18px\] w-\[18px\]/,'Handshake must remain optically legible');assert.match(page,/Completed \(\{completed\.length\}\)/);assert.match(page,/h-11 w-11/,'completion control must retain a comfortable mobile target');assert.match(page,/max-w-\[1120px\]/);assert.match(page,/grid-rows-\[0fr\]/,'completion must collapse smoothly after in-place feedback');assert.match(page,/await wait\(300\)/);assert.match(page,/What do you need to remember\?/);assert.match(page,/My task color/);assert.match(page,/role="combobox"/);assert.match(page,/event\.key === "ArrowDown"/);assert.match(page,/event\.key === "Escape"/);assert.match(page,/tenops_my_work_sort:/);assert.match(page,/Attention/);assert.match(page,/Recently Added/);assert.doesNotMatch(page,/table|overflow-x|kanban|priority|blocked/i);
assert.match(queries,/p_context_type:input\.jobId\?'job':null/);assert.match(queries,/update_my_work_task/);assert.match(queries,/set_my_work_task_completed/);assert.match(inspector,/myOpenTaskCount>0/);assert.match(inspector,/View my tasks for this Job/);assert.match(nav,/href="\/my-work"[\s\S]*data-account-identity/,'My Work must sit on the account side of the header divider');
assert.match(theme,/html\[data-appearance="dark"\] \[data-my-work\] ::selection/);assert.doesNotMatch(page,/completed\.map\(taskCard\)[\s\S]{0,30}opacity-/,'completed text must not inherit compositor opacity');
assert.match(hero,/data-dev-branding=\{BRANDING\.showDeveloperArtwork/);assert.match(theme,/--tendev-signature-pink/);assert.match(theme,/data-welcome-progress-fill/);
assert.match(notifications,/notification_type\.startsWith\("shared_task_"\)/);assert.match(notifications,/router\.push\(`\/my-work\?view=shared&taskId=/);assert.match(arrival,/"shared_task_assigned"/);assert.match(arrival,/"shared_task_completed"/);
console.log('My Work MVP checks passed.');
}
void verify();
