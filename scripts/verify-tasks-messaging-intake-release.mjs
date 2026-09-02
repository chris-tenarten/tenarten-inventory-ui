import assert from 'node:assert/strict';import fs from 'node:fs';
const shell=fs.readFileSync('src/app/client-layout-shell.tsx','utf8');const icons=fs.readFileSync('src/components/primary-navigation-icons.tsx','utf8');const notifications=fs.readFileSync('src/components/AccountNotifications.tsx','utf8');const delivery=fs.readFileSync('scripts/deliver-tasks-messaging-intake-release.mjs','utf8');
assert.match(shell,/import \{ IntakeIcon, MyWorkIcon \} from '@\/components\/primary-navigation-icons'/);
assert.match(icons,/export function IntakeIcon[\s\S]*<Inbox/);assert.match(icons,/export function MyWorkIcon[\s\S]*<svg/);
assert.match(notifications,/tasks_messaging_intake_20260902/);assert.match(notifications,/<MyWorkIcon\/>[\s\S]*<Send[\s\S]*<Inbox/);
assert.match(delivery,/DELIVER_TASKS_MESSAGING_INTAKE_RELEASE/);assert.match(delivery,/maybeSingle/);assert.match(delivery,/Existing release communication differs/);assert.match(delivery,/deliver_tenops_release_communication/);assert.match(delivery,/deliver_to_future_users:false/);
console.log('Tasks / Messaging / Intake release communication checks passed.');
