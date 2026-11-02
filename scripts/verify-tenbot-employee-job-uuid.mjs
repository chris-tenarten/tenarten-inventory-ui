// Focused real PostgreSQL regression for the private display Job UUID predicate.
// Existing fixed synthetic fixture only; all schema/data/sequence changes roll back.
import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,lstatSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const migrationPath='supabase/migrations/20261102190000_tenbot_employee_job_uuid_validation.sql';
const migration=readFileSync(new URL('../'+migrationPath,import.meta.url),'utf8');
const predecessor=readFileSync(new URL('../supabase/migrations/20261102140000_tenbot_operation_history.sql',import.meta.url),'utf8');
const oldBody=predecessor.match(/as \$\$([\s\S]*?)\$\$;/)?.[1];
const sha=x=>createHash('sha256').update(x).digest('hex'),q=x=>"'"+String(x).replaceAll("'","''")+"'";
const OLD='21b9626dbd839ea3d0f158ab06795d7e419206113beecaf3fc628464539b134c',NEW='88d014e71ff09998792c22f12f6a153ec546b2c75f01c4ebeb5a49b514745fb3';
assert.equal(sha(oldBody),OLD);assert(migration.includes(OLD)&&migration.includes(NEW));
assert.doesNotMatch(migration.replace(/^--.*$/gm,''),/\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate|grant|revoke|create\s+(?:or\s+replace\s+)?(?:table|function))\b/i);
assert.equal((migration.match(/^begin;$/gm)??[]).length,1);assert.equal((migration.match(/^commit;$/gm)??[]).length,1);
const resultBase={migration:migrationPath,migrationSha256:sha(migration),oldBodySha256:OLD,newBodySha256:NEW,staticChecks:3,providerCalls:0,ProductionRequests:0};
assert(process.argv.length===2||process.argv.length===3&&process.argv[2]==='--isolated-free-fixture','Use only the fixed isolated fixture switch');
if(process.argv.length===2){console.log(JSON.stringify({passed:true,...resultBase,realPostgreSQL:false},null,2));process.exit(0);}
const ref='jltgxcfiprocydhbrahz',directory='/private/tmp/tenops-tenbot-hosted-adapter-20261029',actorPath='/private/tmp/tenops-tenbot-receival-execution-20261030/receival-actors.private.json';
function config(path){const st=lstatSync(path);assert(st.isFile()&&!st.isSymbolicLink()&&(st.mode&0o077)===0&&st.uid===process.getuid?.());const c=JSON.parse(readFileSync(path));assert(c.projectRef===ref&&c.url==='https://'+ref+'.supabase.co');return c;}
config(directory+'/free-project-credentials.private.json');const actors=config(actorPath),A=actors.actors.employeeA.id,B=actors.actors.employeeB.id;assert(A!==B&&[A,B].every(x=>/^[a-f0-9-]{36}$/.test(x)));
const artifact='/private/tmp/tenops-final-validator-activation-20261102/validator';mkdirSync(artifact,{recursive:true});const scratch=mkdtempSync(artifact+'/sql-');let queries=0;
function query(statement){const path=scratch+'/'+(++queries)+'.sql';writeFileSync(path,statement,{mode:0o600,flag:'wx'});let result;try{result=JSON.parse(execFileSync(process.execPath,[directory+'/branch-query.mjs','--file',path],{encoding:'utf8',timeout:12000,stdio:['ignore','pipe','pipe'],maxBuffer:2000000}));}catch(error){let code='unavailable';try{code=JSON.parse(String(error.stdout)).code;}catch{}throw Error('Fixed isolated validator SQL '+code+'; no shared/provider calls');}assert(result.ok&&Array.isArray(result.rows));return result.rows;}
const hashes=['tenbot_conversations','tenbot_agent_history','tenbot_conversation_turns','app_users','app_role_capabilities','inventory_items','inventory_transactions','jobs','pending_receivals','proposals','tenbot_openai_policy','tenbot_openai_usage','tenbot_action_control','tenbot_receival_execution_control','tenbot_receival_pilot_policy','tenbot_receival_pilot_employees'];
const snapshotSQL=`select jsonb_build_object(
 'targetBody',(select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where oid='public.tenbot_employee_display_valid(jsonb)'::regprocedure),
 'functions',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by oid)::text,'[]')) from pg_proc p where pronamespace='public'::regnamespace and prokind in('f','p')),
 'schema',(select md5(coalesce(jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,(select jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.attnotnull,a.attidentity,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),(select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname) from pg_constraint k where k.conrelid=c.oid),(select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),(select jsonb_agg(to_jsonb(p) order by p.polname) from pg_policy p where p.polrelid=c.oid)) order by c.oid)::text,'[]')) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in('r','p','v','m','f')),
 'rows',jsonb_build_object(${hashes.map(t=>q(t)+",(select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]')) from public."+t+' r)').join(',')}),
 'turnSequence',(select jsonb_build_object('lastValue',last_value,'isCalled',is_called) from public.tenbot_conversation_turns_id_seq),
 'controls',jsonb_build_object('action',(select to_jsonb(c) from public.tenbot_action_control c),'execution',(select to_jsonb(c) from public.tenbot_receival_execution_control c),'policy',(select to_jsonb(c) from public.tenbot_openai_policy c))
) as metadata;`;
const metadata=sql=>query(sql).find(r=>r.metadata)?.metadata,before=metadata('begin read only;'+snapshotSQL+'commit;');
assert.equal(before.targetBody,OLD);assert(!before.controls.action.proposal_enabled&&!before.controls.action.receivals_enabled&&!before.controls.execution.execution_enabled&&!before.controls.policy.enabled,'Existing controls must already be OFF');
const ready=metadata(`begin read only;select jsonb_build_object('actors',(select count(*) from public.app_users u join public.app_role_capabilities c on c.role=u.role where u.user_id in(${q(A)},${q(B)}) and u.is_active and c.capability='readOperationalData'),'persistent',(select count(*) from public.tenbot_conversations where owner_id in(${q(A)},${q(B)}) and persistent),'identity',pg_get_serial_sequence('public.tenbot_conversation_turns','id'),'maxId',(select coalesce(max(id),0)<9000000000000000000 from public.tenbot_conversation_turns)) as metadata;commit;`);
assert(ready.actors===2&&ready.persistent===0&&ready.identity==='public.tenbot_conversation_turns_id_seq'&&ready.maxId,'Reuse existing capable actors without touching their prior conversations');
const conversation=randomUUID(),canonical='11902026-0000-4000-8000-000000000001',short='11902026-0000-4000-000000000001';
const turn={id:randomUUID(),question:'Synthetic Job briefing',message:'Synthetic saved Job status and dates.',createdAt:'2026-11-02T00:00:00Z',answeredAt:'2026-11-02T00:00:01Z',scopeDigest:'a'.repeat(64),sources:[],jobIds:[canonical],contentScope:'operational-history'};
const linked={...turn,actionReferences:[{id:randomUUID(),revision:1,hash:'b'.repeat(64),expiresAt:'2099-01-01T00:00:00Z'}],operationAccess:{documentIds:[randomUUID()],proposalAccess:false}};
const empty={...turn,id:randomUUID(),jobIds:[],contentScope:'scope'};
const dbChecks=[],verify=(name,sql)=>{dbChecks.push(name);return sql;};
const valid=t=>'public.tenbot_employee_display_valid('+q(JSON.stringify(t))+'::jsonb)';
const statements=['begin;',`create function pg_temp.ensure(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Display UUID assertion failed';end if;end$$;`,
 verify('Actual predecessor rejects canonical Job UUID and incorrectly accepts the shorter shape',`select pg_temp.ensure(not ${valid(turn)});select pg_temp.ensure(${valid({...turn,jobIds:[short]})});`),
 `create temp table display_uuid_function_before as select p.oid,to_jsonb(p) as metadata from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind in('f','p');`,
 migration.replace(/^begin;$/m,'').replace(/^commit;$/m,''),
 verify('Canonical and uppercase Job UUIDs and empty references accepted; shorter/non-string/malformed values rejected',`
 select pg_temp.ensure(${valid(turn)});select pg_temp.ensure(${valid({...turn,jobIds:['ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF']})});select pg_temp.ensure(${valid(empty)});
 ${[short,canonical+'0','not-a-uuid',12,null].map(id=>'select pg_temp.ensure(not '+valid({...turn,jobIds:[id]})+');').join('\n')}`),
 verify('Unrelated content validation and existing optional fields retain their original behavior',`
 select pg_temp.ensure(${valid(linked)});
 ${[{...turn,question:''},{...turn,message:'x'.repeat(2401)},{...turn,scopeDigest:'invalid'},{...turn,sources:{}},{...turn,contentScope:'invalid'},{...turn,createdAt:'2026-11-03T00:00:00Z'},{...turn,unexpected:true},{...linked,actionReferences:[{...linked.actionReferences[0],revision:0}]},{...linked,operationAccess:{documentIds:[short],proposalAccess:false}}].map(t=>'select pg_temp.ensure(not '+valid(t)+');').join('\n')}`),
 verify('Only exact target body changes; all other public functions and target security metadata remain byte-exact',`
 select pg_temp.ensure(not exists(select 1 from display_uuid_function_before b join pg_proc p on p.oid=b.oid where case when p.oid='public.tenbot_employee_display_valid(jsonb)'::regprocedure then (to_jsonb(p)-array['prosrc','prosqlbody']) is distinct from (b.metadata-array['prosrc','prosqlbody']) else to_jsonb(p) is distinct from b.metadata end));
 select pg_temp.ensure(not has_function_privilege('authenticated','public.tenbot_employee_display_valid(jsonb)','execute') and not has_function_privilege('anon','public.tenbot_employee_display_valid(jsonb)','execute'));
 select pg_temp.ensure(not has_function_privilege('authenticated','public.tenbot_employee_commit(uuid,uuid,uuid,integer,jsonb,boolean,jsonb)','execute') and has_function_privilege('service_role','public.tenbot_employee_commit(uuid,uuid,uuid,integer,jsonb,boolean,jsonb)','execute'));`),
 // RESTART is transactional (unlike setval). This prevents the two rolled-back
 // inserts from consuming the existing fixture identity sequence permanently.
 `alter sequence public.tenbot_conversation_turns_id_seq restart with 9000000000000000000;
 insert into public.tenbot_conversations(id,owner_id,persistent) values(${q(conversation)},${q(A)},true);
 insert into public.tenbot_agent_history(conversation_id,owner_id) values(${q(conversation)},${q(A)});`,
 verify('Real authenticated-role owner claim and service-only commit enforce owner/revision/claim; canonical display persists',`
 do $display_commit$ declare c jsonb;r jsonb;t jsonb:=${q(JSON.stringify(linked))}::jsonb;s jsonb:='{"guidance":[],"display":[]}'::jsonb;begin
  perform set_config('request.jwt.claims',${q(JSON.stringify({sub:A,role:'authenticated'}))},true);set local role authenticated;
  c:=public.tenbot_employee_claim(${q(conversation)});if c->>'ok'<>'true' then raise exception 'Owner claim rejected';end if;
  begin perform public.tenbot_employee_commit(${q(A)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,s,false,t);raise exception 'Employee invoked service commit';exception when insufficient_privilege then null;end;
  reset role;perform set_config('request.jwt.claims',${q(JSON.stringify({sub:B,role:'authenticated'}))},true);set local role authenticated;
  r:=public.tenbot_employee_claim(${q(conversation)});if r->>'ok'='true' then raise exception 'Foreign owner claimed conversation';end if;
  reset role;set local role service_role;
  if public.tenbot_employee_commit(${q(B)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,s,false,t)
   or public.tenbot_employee_commit(${q(A)},${q(conversation)},gen_random_uuid(),(c->>'revision')::integer,s,false,t)
   or public.tenbot_employee_commit(${q(A)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer+1,s,false,t) then raise exception 'Wrong owner/claim/revision committed';end if;
  if not public.tenbot_employee_commit(${q(A)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,s,false,t) then raise exception 'Canonical owner commit rejected';end if;
  if public.tenbot_employee_commit(${q(A)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,s,false,t) then raise exception 'Stale consumed revision/claim replayed';end if;
  reset role;
  if (select count(*) from public.tenbot_conversation_turns where conversation_id=${q(conversation)})<>1 or not exists(select 1 from public.tenbot_conversation_turns where conversation_id=${q(conversation)} and owner_id=${q(A)} and display_turn=t) then raise exception 'Exact linked canonical display persistence failed';end if;
 end $display_commit$;`),
 verify('Legacy empty display commit/page remains valid; busy and expired leases and foreign-owner page are denied',`
 do $display_lease$ declare c jsonb;r jsonb;page jsonb;t jsonb:=${q(JSON.stringify(empty))}::jsonb;s jsonb:='{"guidance":[],"display":[]}'::jsonb;begin
  perform set_config('request.jwt.claims',${q(JSON.stringify({sub:A,role:'authenticated'}))},true);set local role authenticated;c:=public.tenbot_employee_claim(${q(conversation)});reset role;
  if c->>'ok'<>'true' then raise exception 'Next owner claim rejected';end if;
  set local role service_role;if not public.tenbot_employee_commit(${q(A)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,s,false,t) then raise exception 'Legacy empty commit rejected';end if;reset role;
  set local role authenticated;c:=public.tenbot_employee_claim(${q(conversation)});r:=public.tenbot_employee_claim(${q(conversation)});reset role;
  if c->>'ok'<>'true' or r->>'ok'='true' then raise exception 'Busy lease protection failed';end if;
  set local role service_role;page:=public.tenbot_employee_page(${q(A)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,null);
  if jsonb_array_length(page->'turns')<>2 or public.tenbot_employee_page(${q(B)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,null) is not null then raise exception 'Owner page isolation failed';end if;reset role;
  update public.tenbot_agent_history set claim_until=clock_timestamp()-interval '1 second' where conversation_id=${q(conversation)};
  set local role service_role;if public.tenbot_employee_commit(${q(A)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,s,false,t) or public.tenbot_employee_page(${q(A)},${q(conversation)},(c->>'claim')::uuid,(c->>'revision')::integer,null) is not null then raise exception 'Expired lease accepted';end if;reset role;
 end $display_lease$;`),
 'rollback;',"select jsonb_build_object('done',true) as metadata;",
];
let done;try{done=query(statements.join('\n')).some(r=>r.metadata?.done===true);}finally{const after=metadata('begin read only;'+snapshotSQL+'commit;');assert.deepEqual(after,before,'Exact original functions/schema/records/controls/identity-sequence state must be restored');writeFileSync(scratch+'/restoration.json',JSON.stringify({equal:true,before,after},null,2)+'\n',{mode:0o600,flag:'wx'});}
assert(done);const result={passed:true,...resultBase,realPostgreSQL:true,databaseGroups:dbChecks.length,groups:dbChecks,fixture:ref,queries,rollbackOnly:true,originalFunctionsSchemaRowsControlsAndSequenceRestored:true,newActorsCreated:0,newAuthCalls:0,actualHttpJwtRun:false,claimContext:'Existing authorized synthetic identities under real PostgreSQL authenticated/service_role contexts; accepted prior real signed-JWT/RLS evidence reused.',actualProductionJobUuid:'Root separately verifies actual Job26-0808 acceptance through a read-only shared boolean probe; this fixture uses canonical synthetic UUID only.',scratch};
writeFileSync(scratch+'/results.json',JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify(result,null,2));
