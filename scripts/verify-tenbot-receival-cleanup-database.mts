/** Fixed synthetic fixture only. Proposed ledger is exercised inside one
 * rollback-only transaction; no migration, scheduler or Storage action. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fixtureSql,RECEIVAL_FIXTURE_REF} from './support/tenbot-receival-fixture.mjs';
assert.deepEqual(process.argv.slice(2).sort(),['--authorized-isolated-fixture','--rollback-only']);
const directory='/private/tmp/tenops-tenbot-receival-blockers-20261030';mkdirSync(directory,{recursive:true});
const source='supabase/migrations/20261030200000_tenbot_receival_cleanup_wakes.sql',test='scripts/fixtures/tenbot-receival-cleanup-rollback.sql';
const sha=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
assert.equal(sha(readFileSync(source)),'dacaa8b006fd6f0c284803349d20b696c7603d67054417a595b274e9b46a3496');
const sql=readFileSync(test,'utf8');assert.equal(sha(sql),'df6d10136a829a1e94244a98ab96417686376d4dfd27f3e0414cce7de5746620');
assert(/\nbegin;\s*\n/.test(sql)&&/\nrollback;\s*$/.test(sql));
assert(!/\bcommit\s*;|vault\.decrypted_secrets|\b(?:net\.http_post|cron\.schedule|dispatch_invoice_source_cleanup)\s*\(/i.test(sql));
const ledgerPresent=fixtureSql('cleanup-ledger-presence',"begin read only;select to_regclass('supabase_migrations.schema_migrations') is not null as present;commit;")[0].present===true;
const missingMigration=ledgerPresent?"not exists(select 1 from supabase_migrations.schema_migrations where version='20261030200000')":"to_regclass('supabase_migrations.schema_migrations') is null";
const untouched="select jsonb_build_object('controlAbsent',to_regclass('public.invoice_receival_cleanup_control') is null,'runsAbsent',to_regclass('public.invoice_receival_cleanup_runs') is null,'consumeAbsent',to_regprocedure('public.consume_invoice_receival_cleanup_run(uuid,bigint,integer)') is null,'newMigrationAbsent',"+missingMigration+") as state;";
const before=fixtureSql('cleanup-wake-before','begin read only;'+untouched+'commit;')[0].state;
assert(before&&typeof before==='object'&&Object.values(before).every(Boolean),'Unexpected fixture cleanup objects; stop rather than replace');
const started=Date.now(),rows=fixtureSql('cleanup-wake-rollback',sql),result=rows.find(row=>row.result)?.result as Record<string,unknown>|undefined;
assert.equal(result?.fixture,RECEIVAL_FIXTURE_REF);assert.equal(result?.groupsPassed,9);assert.equal(result?.newMigrationApplied,false);assert.equal(result?.httpOrStorageDeletion,false);
const after=fixtureSql('cleanup-wake-after','begin read only;'+untouched+'commit;')[0].state;assert.deepEqual(after,before,'Rollback did not restore exact object absence');
const receipt={passed:true,recordedAt:new Date().toISOString(),fixtureRef:RECEIVAL_FIXTURE_REF,source,sourceSha256:sha(readFileSync(source)),test,testSha256:sha(sql),durationMs:Date.now()-started,result,before,after,
 actualPostgreSQL:true,fixtureMigrationLedgerPresent:ledgerPresent,rollbackOnly:true,newMigrationApplications:0,dispatcherExecuted:false,storageDeletes:0,cronChanges:0,productionCalls:0,inferenceCalls:0,
 limitations:['Ledger/control/consume/finish/cancel SQL only; dispatcher and pg_net/Vault preflight omitted.','SET ROLE and synthetic claim GUCs exercise actual database privileges; not a new signed JWT/HTTP authentication test.','Cross-connection SQL concurrency and actual hosted scheduler transport remain staging checks.']};
writeFileSync(directory+'/cleanup-ledger-rollback-results.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:9,actualPostgreSQL:true,fixtureMigrationLedgerPresent:ledgerPresent,rollbackOnly:true,newMigrationApplications:0,fixtureRef:RECEIVAL_FIXTURE_REF}));
