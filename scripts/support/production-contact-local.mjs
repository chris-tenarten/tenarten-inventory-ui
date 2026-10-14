import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
export function localConfig() {
 const r=spawnSync('npx',['--yes','supabase@2.110.0','status','--workdir','.tmp-contact-supabase','-o','json'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const config=JSON.parse(r.stdout);
 assert.equal(config.API_URL,'http://127.0.0.1:55581','Contact review must use its isolated local stack');
 return config;
}
export function sql(input) {
 const r=spawnSync('docker',['exec','-i','supabase_db_tenops-contact-review','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
export const migration='20261014190000_production_contact_configuration.sql';
