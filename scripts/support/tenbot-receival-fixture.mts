/** Operator/test harness for the existing synthetic standalone Free project.
 * It is never imported by hosted application code. No argument selects a project.
 * Business RPC tests use real employee JWTs; no service-role business client exists.
 */
import assert from 'node:assert/strict';
import {lstatSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';

export const RECEIVAL_FIXTURE_REF='jltgxcfiprocydhbrahz';
export const RECEIVAL_FIXTURE_DIR='/private/tmp/tenops-tenbot-receival-execution-20261030';
const configPath='/private/tmp/tenops-tenbot-hosted-adapter-20261029/free-project-credentials.private.json';
export const RECEIVAL_ACTOR_CONFIG=RECEIVAL_FIXTURE_DIR+'/receival-actors.private.json';
type Actor={email:string;password:string;id?:string};
type FixtureConfig={fixtureKind:string;projectRef:string;branchRef:string;parentRef:string;url:string;anonKey:string;actors:Record<string,Actor>};

export function receivalFixtureConfig():FixtureConfig{
 const selected=process.env.TENBOT_RECEIVAL_FIXTURE_CONFIG??configPath;
 assert(selected===configPath||selected===RECEIVAL_ACTOR_CONFIG,'Only fixed isolated fixture configuration paths allowed');
 const stat=lstatSync(selected);
 assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid?.()&&(stat.mode&0o077)===0,'Owner-only existing fixture configuration required');
 const config=JSON.parse(readFileSync(selected,'utf8')) as FixtureConfig;
 assert(config.fixtureKind==='standalone-free'&&config.projectRef===RECEIVAL_FIXTURE_REF&&config.branchRef===RECEIVAL_FIXTURE_REF&&config.parentRef!==RECEIVAL_FIXTURE_REF);
 assert.equal(config.url,'https://'+RECEIVAL_FIXTURE_REF+'.supabase.co');
 assert(config.actors.employeeA&&config.actors.employeeB&&(config.actors.admin||config.actors.member));
 return config;
}

let httpCalls=0;
export const fixtureHttpCalls=()=>httpCalls;
const boundedFetch:typeof fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 assert.equal(url.hostname,RECEIVAL_FIXTURE_REF+'.supabase.co','No non-fixture request permitted');
 assert.equal(url.protocol,'https:');httpCalls++;
 return fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(8000),...(init.signal?[init.signal]:[])])});
};
export function fixtureClient(jwt?:string):SupabaseClient{
 const c=receivalFixtureConfig();
 return createClient(c.url,c.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch,...(jwt?{headers:{Authorization:'Bearer '+jwt}}:{})}});
}
export async function fixtureEmployee(label:'employeeA'|'employeeB'|'admin'){
 const config=receivalFixtureConfig(),actor=config.actors[label],client=fixtureClient();
 const result=await client.auth.signInWithPassword({email:actor.email,password:actor.password});
 assert(!result.error&&result.data.user&&result.data.session,'Real synthetic employee sign-in failed');
 assert(!actor.id||result.data.user.id===actor.id,'Synthetic identity mismatch');
 const verified=await client.auth.getUser(result.data.session.access_token);
 assert(!verified.error&&verified.data.user?.id===result.data.user.id,'Signed JWT could not be verified by Auth');
 return {client:fixtureClient(result.data.session.access_token),id:result.data.user.id,jwt:result.data.session.access_token,expiresAt:result.data.session.expires_at!};
}

/** Fixed, bounded operator SQL for synthetic setup/revocation assertions only.
 * The application/agent never receives this helper, shell, Management key or SQL.
 */
export function fixtureSql(label:string,sql:string):Record<string,unknown>[] {
 receivalFixtureConfig();assert(/^[a-z0-9-]{1,80}$/.test(label));
 assert(!/vault\.decrypted_secrets|select\s+[^;]*\b(?:jwt_secret|api_key|service_role_key)\b/i.test(sql));
 mkdirSync(RECEIVAL_FIXTURE_DIR,{recursive:true});const file=RECEIVAL_FIXTURE_DIR+'/'+label+'.sql';
 writeFileSync(file,sql+'\n',{mode:0o600});
 const result=spawnSync(process.execPath,['/private/tmp/tenops-tenbot-hosted-adapter-20261029/branch-query.mjs','--file',file],{encoding:'utf8',timeout:15000,killSignal:'SIGKILL',maxBuffer:2e6});
 const reply=(()=>{try{return JSON.parse(result.stdout);}catch{return null;}})() as {ok?:boolean;code?:string;rows?:Record<string,unknown>[]} | null;
 assert(result.status===0&&reply?.ok===true&&Array.isArray(reply.rows),'Isolated fixture SQL failed: '+(reply?.code??'bounded-helper-failure'));
 return reply!.rows!;
}
