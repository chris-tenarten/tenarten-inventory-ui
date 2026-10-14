// Deliberately LOCAL ONLY; no hosted execution option. The migration itself does not import.
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localConfig } from './support/production-contact-local.mjs';
const cfg=localConfig();
const accounts=JSON.parse(await readFile('.tmp-contact-review/accounts.json','utf8'));
const account=accounts.find(a=>a.email==='contact-admin@example.invalid');
const client=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await client.auth.signInWithPassword({email:account.email,password:account.password});if(login.error)throw login.error;
const result=await client.rpc('import_approved_historical_customers_20261014');if(result.error)throw result.error;
const manifest=await readFile('docs/project-memory/customer-import-approved-2026-10-14.json','utf8');
const receipt={localUrl:cfg.API_URL,manifestSha256:createHash('sha256').update(manifest).digest('hex'),rows:result.data};
await writeFile('output/customer-import/local-import-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(result.data.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})));
