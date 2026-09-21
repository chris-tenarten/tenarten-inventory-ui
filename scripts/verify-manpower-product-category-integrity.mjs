import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// SELECT-only capture files from the gate SQL; this verifier never connects to a database.
const capture = (path) => {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  return value.gate ?? value.rows?.[0]?.gate ?? value;
};
const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) throw new Error('Usage: node scripts/verify-manpower-product-category-integrity.mjs BEFORE.json AFTER.json');
const before = capture(beforePath);
const after = capture(afterPath);
assert.equal(after.digest_format, before.digest_format);
assert.equal(after.integrity_sha256, before.integrity_sha256, 'Protected business rows changed; stop cutover and investigate.');
assert.equal(after.reporting_sha256, before.reporting_sha256, 'Reporting dimensions/counts/hours changed.');
assert.deepEqual(after.protected_relations, before.protected_relations);
assert.deepEqual(after.historical_entry_manifest, before.historical_entry_manifest);
assert.deepEqual(after.counts, before.counts, 'Counts/hours/categories must be unchanged before reopening writes.');
assert.equal(after.counts.classified_entries, 0, 'Historical entries must remain Uncategorized.');
assert.equal(after.category_table, 'manpower_product_categories');
assert.equal(after.new_capability_rows, 2);
assert.deepEqual(after.role_caps.filter(row => row.capability === 'manageManpowerProductCategories').map(row => row.role).sort(), ['admin', 'lead']);
const categoryColumn = after.columns.find(column => column.table === 'manpower_entries' && column.name === 'product_category_id');
assert.ok(categoryColumn);
assert.equal(categoryColumn.type, 'pg_catalog.uuid');
assert.equal(categoryColumn.nullable, 'YES');
assert.equal(categoryColumn.default, null);
const existingOnly = rows => rows.filter(row => row.table !== 'manpower_product_categories' && row.tablename !== 'manpower_product_categories');
assert.deepEqual(existingOnly(after.policies), before.policies, 'Existing policies must remain unchanged.');
assert.deepEqual(existingOnly(after.grants), before.grants, 'Existing table grants must remain unchanged.');
assert.ok(after.triggers.some(trigger => trigger.table === 'manpower_entries' && trigger.enabled === 'O' && trigger.definition.includes('manpower_entry_product_category_guard')));
console.log(`Integrity passed: ${after.counts.entries} historical entries / ${after.counts.hours} hours, all protected rows and reporting unchanged; nullable category and Lead/Admin grants present.`);
