import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql", import.meta.url),
  "utf8",
);
const inventory = await readFile(new URL("../src/app/inventory/page.tsx", import.meta.url), "utf8");

assert.match(migration, /Pending Receivals RBAC insert[\s\S]*has_app_capability\('adjustInventory'\)/);
assert.match(migration, /Pending Receivals RBAC update[\s\S]*has_app_capability\('adjustInventory'\)/);
assert.match(migration, /Pending Receivals RBAC delete[\s\S]*has_app_capability\('adjustInventory'\)/);
assert.match(migration, /receive_pending_receival_with_reservation[\s\S]*require_app_capability\('receiveInventory'\)/);
assert.match(migration, /undo_pending_receival_receipt[\s\S]*require_app_capability\('adjustInventory'\)/);
assert.match(migration, /create_pending_receivals_from_purchase_order[\s\S]*require_app_capability\('adjustInventory'\)/);
assert.match(migration, /revoke all on function public\.receive_pending_receival\(uuid, text\)/);
assert.match(migration, /revoke all on function public\.purge_test_purchase_order\(uuid, text, text\)/);
assert.doesNotMatch(migration, /rbac_final_enforcement|pgrst\.db_pre_request|RBAC_ENFORCED/i);
assert.doesNotMatch(inventory, /tenarten_pending_receival_access|PENDING_RECEIVAL_PASSWORD|pendingReceivalPasswordInput|unlockPendingReceivalForm/);

console.log("Pending Receival RBAC source verification passed.");
