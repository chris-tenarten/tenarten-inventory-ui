import { createClient } from '@supabase/supabase-js';

const operation = process.argv.includes('--cleanup') ? 'cleanup' : process.argv.includes('--apply') ? 'apply' : '';
const requiredConfirmation = operation === 'cleanup' ? 'DELETE_MY_WORK_TEST_FIXTURES' : 'CREATE_MY_WORK_TEST_FIXTURES';
if (!operation) throw new Error('Choose exactly one explicit operation: --apply or --cleanup.');
if (process.env.NEXT_PUBLIC_DEV_BRANDING !== 'true') throw new Error('Refusing fixtures: NEXT_PUBLIC_DEV_BRANDING must be exactly "true".');
if (process.env.TENOPS_DEV_FIXTURE_CONFIRM !== requiredConfirmation) throw new Error(`Refusing fixtures: set TENOPS_DEV_FIXTURE_CONFIRM=${requiredConfirmation} for this one intentional run.`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Keep credentials in local environment state only.');
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const fixtureIds = [
  'f17e0001-0000-4000-8000-000000000001','f17e0001-0000-4000-8000-000000000002','f17e0001-0000-4000-8000-000000000003',
  'f17e0001-0000-4000-8000-000000000004','f17e0001-0000-4000-8000-000000000005','f17e0001-0000-4000-8000-000000000006',
  'f17e0001-0000-4000-8000-000000000007','f17e0001-0000-4000-8000-000000000008','f17e0001-0000-4000-8000-000000000009',
];

if (operation === 'cleanup') {
  const { data: candidates, error: candidateError } = await supabase.from('work_tasks').select('id,title').in('id', fixtureIds);
  if (candidateError) throw candidateError;
  const unsafe = (candidates ?? []).filter((task) => !task.title.startsWith('[TEST] '));
  if (unsafe.length) throw new Error(`Cleanup refused: fixture ID collision with non-test task(s): ${unsafe.map((task) => task.id).join(', ')}`);
  const { error } = await supabase.from('work_tasks').delete().in('id', fixtureIds).like('title', '[TEST] %');
  if (error) throw error;
  const { error: notificationError } = await supabase.from('account_notifications').delete().in('notification_key', fixtureIds.map((id) => `my-work-dev-fixture:${id}`));
  if (notificationError) throw notificationError;
  console.log(JSON.stringify({ operation, deleted: candidates?.length ?? 0, fixtureIds }, null, 2));
  process.exit(0);
}

const { data: accounts, error: accountsError } = await supabase.from('app_users').select('user_id,display_name,role,is_active').in('display_name', ['Chris Ngo', 'chris (dev acct)']);
if (accountsError) throw accountsError;
const admin = accounts?.find((account) => account.display_name === 'Chris Ngo' && account.role === 'admin' && account.is_active);
const developer = accounts?.find((account) => account.display_name === 'chris (dev acct)' && account.role === 'developer' && account.is_active);
if (!admin || !developer || accounts?.length !== 2) throw new Error('Fixture account resolution failed: expected exactly active Chris Ngo/Admin and chris (dev acct)/Developer records.');

const { data: jobs, error: jobsError } = await supabase.from('jobs').select('id,name,job_number').eq('name', 'chris-dev-test').eq('job_number', 'DEV-20260803');
if (jobsError) throw jobsError;
if (jobs?.length !== 1) throw new Error('Fixture Job resolution failed: expected exactly one chris-dev-test / DEV-20260803 Job.');
const jobId = jobs[0].id;
const date = (offset) => { const value = new Date(); value.setHours(12, 0, 0, 0); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); };
const now = new Date().toISOString();
const base = { notes: '[TEST] Disposable TenDev My Work fixture.', context_type: null, context_id: null, completed_at: null };
const fixtures = [
  { ...base, id: fixtureIds[0], title: '[TEST] Review Belmont sample approval', visibility: 'private', creator_user_id: admin.user_id, assignee_user_id: admin.user_id, due_date: null },
  { ...base, id: fixtureIds[1], title: '[TEST] Follow up on overdue material delivery', visibility: 'private', creator_user_id: admin.user_id, assignee_user_id: admin.user_id, due_date: date(-2) },
  { ...base, id: fixtureIds[2], title: '[TEST] Confirm shop drawing dimensions', visibility: 'private', creator_user_id: admin.user_id, assignee_user_id: admin.user_id, due_date: date(0), context_type: 'job', context_id: jobId },
  { ...base, id: fixtureIds[3], title: '[TEST] Attach sample image or PDF', visibility: 'private', creator_user_id: admin.user_id, assignee_user_id: admin.user_id, due_date: date(3), context_type: 'job', context_id: jobId },
  { ...base, id: fixtureIds[4], title: '[TEST] Archived coordination check', visibility: 'private', creator_user_id: admin.user_id, assignee_user_id: admin.user_id, due_date: date(-7), completed_at: now },
  { ...base, id: fixtureIds[5], title: '[TEST] Send fabrication notes to Chris Dev', visibility: 'shared', creator_user_id: admin.user_id, assignee_user_id: developer.user_id, due_date: date(0) },
  { ...base, id: fixtureIds[6], title: '[TEST] Check tomorrow production handoff', visibility: 'private', creator_user_id: developer.user_id, assignee_user_id: developer.user_id, due_date: date(1) },
  { ...base, id: fixtureIds[7], title: '[TEST] Review next-week material needs', visibility: 'private', creator_user_id: developer.user_id, assignee_user_id: developer.user_id, due_date: date(7) },
  { ...base, id: fixtureIds[8], title: '[TEST] Send fabrication notes to Chris', visibility: 'shared', creator_user_id: developer.user_id, assignee_user_id: admin.user_id, due_date: date(2), context_type: 'job', context_id: jobId },
];
const { error: upsertError } = await supabase.from('work_tasks').upsert(fixtures, { onConflict: 'id' });
if (upsertError) throw upsertError;
console.log(JSON.stringify({ operation, source: new URL(url).origin, resolvedAccounts: [{ userId: admin.user_id, displayName: admin.display_name, role: admin.role, fixturesCreated: 6 }, { userId: developer.user_id, displayName: developer.display_name, role: developer.role, fixturesCreated: 3 }], job: jobs[0], totalFixtures: fixtures.length, notificationsCreated: 0 }, null, 2));
