/** Disposable local Auth/PostgREST + actual Inbox. Never connects to hosted data. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const local=process.env.MESSAGING_LOCAL_WORKDIR||'/private/tmp/tenops-messaging-large-attachments/.tmp-messaging-supabase';
let fixture=readFileSync('scripts/verify-messaging-storage-local.mjs','utf8').split('const mid=randomUUID()')[0];
fixture=fixture.replaceAll("'.tmp-messaging-supabase'",JSON.stringify(local));
let tests=readFileSync('scripts/messaging-v11-tests.mjs','utf8').split('try{\n const contexts=')[0];
tests=tests.replace("const[open,setOpen]=useState(true);", "const[open,setOpen]=useState(true);const[peer,setPeer]=useState(new URLSearchParams(location.search).has('list')?'':actor.id===cfg.actors[0].id?cfg.actors[1].id:cfg.actors[0].id);window.openPeer=id=>{setPeer(id);setOpen(true)};window.closeInbox=()=>setOpen(false);");
tests=tests.replace("initialUserId={cfg.actors[Number(new URLSearchParams(location.search).get('actor')||0)===0?1:0].id}","initialUserId={peer}");
tests=tests.replace('const[peer,setPeer]=useState', 'const[identity,setIdentity]=useState(actor);window.switchActor=async i=>{await supabase.auth.signOut();window.actor=cfg.actors[i];await supabase.auth.setSession(window.actor.session);setIdentity(window.actor)};window.signOut=async()=>{await supabase.auth.signOut();setIdentity({id:"",role:"guest"})};const[peer,setPeer]=useState');
tests=tests.replace('currentUserId={actor.id}', "key={open?'open':'closed'} currentUserId={identity.id}");
if(process.env.MESSAGING_LATENCY_SOURCE_ROOT)tests=tests.replaceAll('resolveDir:process.cwd()', 'resolveDir:'+JSON.stringify(process.env.MESSAGING_LATENCY_SOURCE_ROOT));
tests+=readFileSync(process.env.MESSAGING_COLD_TEST?'scripts/messaging-cold-tests.mjs':'scripts/messaging-latency-tests.mjs','utf8');
mkdirSync('.tmp-messaging-v11',{recursive:true});
writeFileSync('.tmp-messaging-v11/latency.mjs',fixture+tests);
const result=spawnSync(process.execPath,['.tmp-messaging-v11/latency.mjs','--reset-local-fixture'],{stdio:'inherit',env:process.env});
process.exitCode=result.status;
