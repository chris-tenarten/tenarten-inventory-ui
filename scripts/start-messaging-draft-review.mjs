import {spawn} from 'node:child_process';
import {startMessagingDraftFixture,REVIEW_API_URL,REVIEW_ANON_KEY,REVIEW_EMAIL,REVIEW_PASSWORD} from './support/messaging-draft-review-fixture.mjs';
const build=process.argv.includes('--build');
const server=build?null:startMessagingDraftFixture();
const child=spawn('npm',build?['run','build']:['run','dev','--','--hostname','localhost','--port','3000'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:REVIEW_API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:REVIEW_ANON_KEY,NEXT_PUBLIC_RBAC_MODE:'enforced',RBAC_ENFORCED:'true',NEXT_PUBLIC_DEV_BRANDING:'false'}});
console.log(`Synthetic local review: http://localhost:3000 — ${REVIEW_EMAIL} / ${REVIEW_PASSWORD}`);
child.on('exit',code=>{server?.close();process.exit(code??1);});
