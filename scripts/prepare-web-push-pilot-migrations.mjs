// Render, never execute. One transaction prevents exposing intermediate Stage B contracts.
import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const names=['20261020200000_web_push_device_registration.sql','20261020210000_web_push_transport.sql','20261020220000_web_push_tendev_pilot_guard.sql'];
const parts=names.map(name=>{const source=readFileSync('supabase/migrations/'+name,'utf8');return{name,sha256:createHash('sha256').update(source).digest('hex'),sql:source.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'')};});
const destination=process.argv[2];if(!destination)throw Error('Supply an output SQL file; this command never applies migrations.');
writeFileSync(destination,'-- REVIEWED PILOT BUNDLE: NOT APPLIED. Do not run generic migration push.\nbegin;\n'+parts.map(p=>`-- ${p.name} SHA256 ${p.sha256}\n${p.sql}`).join('\n')+'\ncommit;\n');
console.log(JSON.stringify({destination,migrations:parts.map(({name,sha256})=>({name,sha256})),applied:false},null,2));
