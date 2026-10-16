/** One disposable PostgreSQL container, real affected migrations/RLS + byte-backed Storage adapter. */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const container='tenops-rich-release-'+process.pid;
function docker(args,input,timeout=20000){const r=spawnSync('docker',args,{input,encoding:'utf8',timeout,maxBuffer:4*1024*1024});if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr);return r.stdout.trim();}
try{
 docker(['info'],undefined,15000);docker(['ps'],undefined,15000);
 docker(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=postgres','postgres:17.6']);
 let ready=false;for(let i=0;i<40;i++){const r=spawnSync('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres'],{timeout:1500});if(r.status===0){ready=true;break;}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Disposable database startup did not become ready; stop without recovery cycle.');
 const fixture=readFileSync('scripts/verify-messaging-attachments-db.mjs','utf8').split('const history=')[0].replace("const container='tenops-messaging-qa'",`const container='${container}'`);
 mkdirSync('.tmp-rich-release',{recursive:true});writeFileSync('.tmp-rich-release/check.mjs',fixture+readFileSync('scripts/support/rich-release-checks.mjs','utf8'));
 const result=spawnSync(process.execPath,['.tmp-rich-release/check.mjs'],{stdio:'inherit',timeout:120000});if(result.error)throw result.error;process.exitCode=result.status;
}finally{try{docker(['stop',container]);}catch{/* only this verifier's resource; no recovery */}}
