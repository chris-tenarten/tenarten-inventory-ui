// Hosted READ ONLY: only Jobs id/customer/archived_at and directory identity metadata.
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { loadCompleteCustomerRows,buildCustomerImportPreview } from './support/customer-import.mjs';
const env=parseEnv(await readFile('/Users/chrisngo/source/repos/tenarten-inventory-ui/.env.local','utf8'));
const url=env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname,'vxdxjhazkqhpkwdqtobp.supabase.co','Unexpected hosted project; stop');
const client=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const jobs=await loadCompleteCustomerRows((from,to)=>client.from('jobs').select('id,customer,archived_at',{count:'exact'}).order('id').range(from,to));
const presence=await client.from('production_companies').select('id,name,archived_at',{count:'exact'}).order('id').range(0,0);
let companies={rows:[],total:0,pages:[]};
if(presence.error){assert(['PGRST205','42P01'].includes(presence.error.code),'Unexpected directory read error: '+presence.error.message);}
else companies=await loadCompleteCustomerRows((from,to)=>client.from('production_companies').select('id,name,archived_at',{count:'exact'}).order('id').range(from,to));
const preview=buildCustomerImportPreview(jobs.rows,companies.rows);
await mkdir('.tmp-customer-import',{recursive:true});
await writeFile('.tmp-customer-import/hosted-customer-rows.json',JSON.stringify({jobs:jobs.rows,companies:companies.rows}),{mode:0o600});
await writeFile('output/customer-import/hosted-preview.json',JSON.stringify({timestamp:new Date().toISOString(),project:'vxdxjhazkqhpkwdqtobp',readOnly:true,directoryPresent:!presence.error,pagination:{jobs:jobs.pages,companies:companies.pages},...preview},null,2)+'\n');
console.log(JSON.stringify({complete:true,directoryPresent:!presence.error,counts:preview.counts,pages:jobs.pages},null,2));
