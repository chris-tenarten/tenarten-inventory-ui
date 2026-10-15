// Actual app + synthetic localhost API. No Docker dependency, hosted credentials or database writes.
import {spawn} from 'node:child_process';
import {startCustomerDialogFixture,REVIEW_API_URL,REVIEW_ANON_KEY,REVIEW_EMAIL,REVIEW_PASSWORD} from './support/customer-dialog-review-fixture.mjs';
const server=startCustomerDialogFixture();
const child=spawn('npm',['run','dev','--','--hostname','localhost','--port','3000'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:REVIEW_API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:REVIEW_ANON_KEY,NEXT_PUBLIC_RBAC_MODE:'enforced',RBAC_ENFORCED:'true',NEXT_PUBLIC_DEV_BRANDING:'false'}});
console.log(`Local review: http://localhost:3000 — ${REVIEW_EMAIL} / ${REVIEW_PASSWORD} (synthetic only)`);
child.on('exit',code=>{server.close();process.exit(code??1);});
