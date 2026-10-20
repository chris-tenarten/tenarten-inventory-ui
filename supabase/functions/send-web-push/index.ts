import {serveWebPush} from './runtime.ts';
serveWebPush(Deno.env.get('WEB_PUSH_ENVIRONMENT')||'','WEB_PUSH_');
