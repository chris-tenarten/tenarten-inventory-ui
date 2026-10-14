/** Offline release artifact only. Never connects to or executes SQL against a database. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const migrations=[
 '20261014190000_production_contact_configuration.sql',
 '20261014210000_production_customer_list.sql',
 '20261014220000_protected_job_contacts.sql',
 '20261014221000_defer_project_contact_detachment.sql',
 '20261014222000_preserve_archived_project_contact_refresh.sql',
 '20261014230000_approved_historical_customer_names.sql',
];
const sha=text=>createHash('sha256').update(text).digest('hex');
const receipts=[];let bundle="-- REVIEW ARTIFACT ONLY. Requires separate hosted migration authorization.\n-- Apply all six atomically; do not use blanket db push. No import is executed.\nbegin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\n";
for(const filename of migrations){
 const original=await readFile(new URL('../supabase/migrations/'+filename,import.meta.url),'utf8');
 assert.equal((original.match(/^begin;$/gm)||[]).length,1);
 assert(original.trimEnd().endsWith('commit;'));
 const body=original.replace(/^begin;\n/m,'').slice(0,-(original.endsWith('\n')?8:7));
 const [version,...rest]=filename.slice(0,-4).split('_'),name=rest.join('_');
 assert(!body.includes('$tenops_receipt$'));
 receipts.push({filename,sha256:sha(original)});
 bundle+=`\n-- ${filename}\n${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name}',array[$tenops_receipt$${body}$tenops_receipt$]);\n`;
}
bundle+='commit;\n';
const output=new URL('../output/combined-release/',import.meta.url);await mkdir(output,{recursive:true});
await writeFile(new URL('contact-migrations.sql',output),bundle);
await writeFile(new URL('contact-migrations-manifest.json',output),JSON.stringify({migrations:receipts,bundleSha256:sha(bundle),executesImport:false,hostedApplied:false},null,2)+'\n');
console.log(JSON.stringify({migrations:receipts,bundleSha256:sha(bundle),hostedApplied:false},null,2));
