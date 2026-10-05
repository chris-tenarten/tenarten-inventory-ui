/** Start/build actual TenOps with a strictly local, disposable permission-review source. */
import { spawn, spawnSync } from 'node:child_process';
import { readFile,writeFile,mkdir,cp } from 'node:fs/promises';
if(process.argv.includes('--prepare')) {
  let config=await readFile('auth-qa/supabase/config.toml','utf8');
  config=config.replaceAll('tenops-auth-qa','tenops-permission-review').replaceAll('54321','55481').replaceAll('54322','55482').replaceAll('54320','55480').replaceAll('54324','55484').replaceAll('54325','55485').replaceAll('54326','55486').replace('[realtime]\nenabled = false','[realtime]\nenabled = true').replace('[storage]\nenabled = false','[storage]\nenabled = true\nfile_size_limit = "50MiB"').replace('[edge_runtime]\nenabled = false','[edge_runtime]\nenabled = true');
  config=config.slice(0,config.indexOf('[auth.email.template.confirmation]'))+config.slice(config.indexOf('[edge_runtime]'));
  await mkdir('.tmp-permission-supabase/supabase',{recursive:true});
  await mkdir('.tmp-permission-review',{recursive:true});
  await writeFile('.tmp-permission-supabase/supabase/config.toml',config);
  await cp('supabase/functions','.tmp-permission-supabase/supabase/functions',{recursive:true});
  await writeFile('.tmp-permission-review/edge.env','RBAC_ENFORCED=true\n',{mode:0o600});
  console.log('Prepared isolated local permission-review configuration.');
  process.exit(0);
}
const result=spawnSync('npx',['--yes','supabase@2.110.0','status','--workdir','.tmp-permission-supabase','-o','json'],{encoding:'utf8'});
if(result.status!==0)throw Error('Start the local permission-review Supabase stack first.');
const cfg=JSON.parse(result.stdout);
if(new URL(cfg.API_URL).origin!=='http://127.0.0.1:55481')throw Error('Refusing a nonlocal permission-review source.');
const child=spawn('npm',process.argv.includes('--build')?['run','build']:['run','dev','--','--port','3000'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:cfg.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:cfg.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:cfg.SERVICE_ROLE_KEY,NEXT_PUBLIC_RBAC_MODE:'enforced',RBAC_ENFORCED:'true',NEXT_PUBLIC_DEV_BRANDING:'false'}});
child.on('exit',(code,signal)=>{if(signal)process.kill(process.pid,signal);process.exit(code??1);});
