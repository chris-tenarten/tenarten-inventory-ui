import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/app/inventory/page.tsx', import.meta.url), 'utf8');
const activity = await readFile(new URL('../src/app/activity/page.tsx', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260722_001_pending_receival_undo.sql', import.meta.url), 'utf8');

assert.match(page, /undo_pending_receival_receipt/);
assert.match(page, /Undo Receive/);
assert.match(page, /Undo is blocked if this stock changed after it was received/);
assert.match(page, /p_reason: undoReceiveReasonInput\.trim\(\) \|\| null/);
assert.match(activity, /row\.reversed_at/);

assert.match(migration, /receipt_inventory_item_id bigint references public\.inventory_items/);
assert.match(migration, /receipt_transaction_id uuid references public\.inventory_transactions/);
assert.match(migration, /pending_receival_id uuid references public\.pending_receivals/);
assert.match(migration, /where id = p_receival_id\s+for update/);
assert.match(migration, /inventory\.updated_at is distinct from receival\.received_at/);
assert.match(migration, /delete from public\.inventory_items where id = inventory\.id/);
assert.match(migration, /set quantity = quantity - receipt_tx\.quantity/);
assert.match(migration, /reversal_of_transaction_id/);
assert.match(migration, /set reversed_at = event_time, reversed_by = trim\(p_actor\)/);
assert.match(migration, /set quantity_received = 0,[\s\S]*status = 'pending'/);
assert.match(migration, /begin;[\s\S]*commit;/);

console.log('Pending receival undo workflow checks passed.');
