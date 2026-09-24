/** Offline validation only: never connects to a database or Storage. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const m=JSON.parse(readFileSync('scripts/fixtures/intake-demo-final/manifest.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ids=[];let events=0,updates=0;
for(const r of m.records){
 ids.push(r.fields.id,r.attachment.id,...r.activities.map(a=>a.id),...r.updates.map(u=>u.id));events+=r.activities.length;updates+=r.updates.length;
 assert.match(r.fields.customer,/^TEST CUSTOMER/);assert.match(r.fields.contact_email,/@example\.invalid$/);assert.match(r.fields.contact_phone,/^202-555-010[1-8]$/);
 assert.equal(r.fields.production_job_id,null);assert.equal(r.fields.owner_user_id,m.owner.user_id);
 assert.equal(sha(readFileSync(r.attachment.local_path)),r.attachment.sha256);
 assert.equal(r.attachment.storage_path,`${r.fields.id}/${r.attachment.id}`);
}
assert.equal(new Set(ids).size,ids.length);assert.equal(events,15);assert.equal(updates,16);
assert.equal(m.records.filter(r=>r.fields.status==='won'&&r.fields.deposit_received_date).length,1);
assert.equal(m.records[7].fields.status,'won');
const files=['01-seed-metadata.sql','02-prepare-cleanup.sql','03-finish-cleanup.sql','04-verify.sql'];
const before=files.map(f=>sha(readFileSync('output/intake-demo/'+f)));
const result=spawnSync(process.execPath,['scripts/prepare-intake-demo-final.mjs'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
assert.deepEqual(files.map(f=>sha(readFileSync('output/intake-demo/'+f))),before);
const seed=readFileSync('output/intake-demo/01-seed-metadata.sql','utf8');
assert.equal((seed.match(/insert into public\.bids\(/g)||[]).length,8);
assert.equal((seed.match(/insert into public\.bid_activity\(/g)||[]).length,15);
assert.equal((seed.match(/insert into public\.bid_updates\(/g)||[]).length,16);
assert.equal((seed.match(/insert into public\.canonical_files\(/g)||[]).length,8);
assert.doesNotMatch(seed,/insert into public\.(jobs|samples|proposals)|perform public\.convert_bid_to_production/i);
for(const file of files)assert.doesNotMatch(readFileSync('output/intake-demo/'+file,'utf8'),/8d197211-b050-43bc-9ff7-2b03bc061a57|delete from storage\.objects/i);
const cleanup=readFileSync('output/intake-demo/03-finish-cleanup.sql','utf8');
assert.match(cleanup,/Converted fixture is protected/);assert.match(cleanup,/admin_permanently_delete_bid/);assert.match(cleanup,/Remove the exact fixture objects through Storage API first/);
const noApproval=spawnSync(process.execPath,['scripts/intake-demo-storage.mjs','--mode=upload'],{encoding:'utf8'});
assert.notEqual(noApproval.status,0);assert.match(noApproval.stderr,/Explicit approval/);
const plan=spawnSync(process.execPath,['scripts/intake-demo-storage.mjs'],{encoding:'utf8'});assert.equal(plan.status,0);assert.equal(JSON.parse(plan.stdout).networkRequests,0);
console.log('PASS: deterministic package/IDs/PDF hashes, exact row counts, Won gate fixture, no Job/document creation, ABC exclusion, cleanup/conversion guards, default no-network mode and explicit approval guard. SQL/Storage mutations were NOT executed.');
