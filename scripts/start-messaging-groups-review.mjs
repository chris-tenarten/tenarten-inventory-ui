// Uses existing fixture session, no created accounts or hosted connections.
import {spawn} from 'node:child_process';
import {startMessagingGroupsFixture,REVIEW_API_URL,REVIEW_ANON_KEY} from './support/messaging-groups-review-fixture.mjs';
const production=process.argv.includes('--production');const build=process.argv.includes('--build');const server=build?null:startMessagingGroupsFixture();
const child=spawn(production?process.execPath:'npm',build?['run','build']:production?['tests/support/static-server.mjs']:['run','dev','--','--hostname','localhost','--port','3000'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:REVIEW_API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:REVIEW_ANON_KEY,NEXT_PUBLIC_RBAC_MODE:'enforced',RBAC_ENFORCED:'true',NEXT_PUBLIC_DEV_BRANDING:'true'}});
console.log('Messaging group/reply review: http://localhost:3000 — local synthetic fixture only.');
child.on('exit',code=>{server?.close();process.exit(code??1);});
