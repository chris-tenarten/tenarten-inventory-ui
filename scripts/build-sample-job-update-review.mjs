import {spawn} from 'node:child_process';
const child=spawn('npm',['run','build','--','--webpack'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://localhost:3000',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-review-public-key',NEXT_PUBLIC_RBAC_MODE:'enforced',RBAC_ENFORCED:'true',NEXT_PUBLIC_DEV_BRANDING:'false'}});
child.on('exit',code=>process.exit(code??1));
