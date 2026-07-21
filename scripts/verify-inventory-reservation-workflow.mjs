import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/app/inventory/page.tsx', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260721_001_atomic_inventory_reservations.sql', import.meta.url), 'utf8');

assert.match(page, /reserve_inventory_quantity/);
assert.match(page, /release_inventory_reservation/);
assert.match(page, /release_inventory_reservations_bulk/);
assert.match(page, /Reserve the entire selected lot/);
assert.match(page, /Return to General Stock/);
assert.doesNotMatch(page, /Number\(editReserveQuantity \|\| currentQty\)/);

assert.match(migration, /where id = p_item_id for update/);
assert.match(migration, /quantity = quantity - p_quantity/);
assert.match(migration, /delete from public\.inventory_items where id = source\.id/);
assert.match(migration, /foreach item_id in array p_item_ids loop/);
assert.match(migration, /begin;[\s\S]*commit;/);

console.log('Atomic inventory reservation workflow checks passed.');
