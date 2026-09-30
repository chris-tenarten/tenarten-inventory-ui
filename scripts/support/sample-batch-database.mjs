import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
export const admin='00000000-0000-0000-0000-000000000010';
export const member='00000000-0000-0000-0000-000000000002';
export const referenceMigration='20260930220000_sample_batch_reference_thickness.sql';
export const migration='20260930170000_sample_batch_chip_basis.sql';
export function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(r.stdout+'\n'+r.stderr);return r.stdout.trim();}
export const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
export const json=v=>literal(JSON.stringify(v))+'::jsonb';
export const asUser=(statement,id=admin)=>`select set_config('request.jwt.claim.sub','${id}',false); ${statement}`;
export function sql(name,statement){return docker(['exec','-i',name,'psql','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],statement).split('\n').filter(x=>x!==admin&&x!==member).join('\n');}
export function startDatabase(name,{applyBatch=true}={}){
 docker(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres','postgres:17.6']);
 for(let i=0;i<60;i++){if(spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}
 // Reuse the established disposable Sample bootstrap, not a second approximation of its schema.
 const source=readFileSync('scripts/verify-sample-mass-balance-migration.mjs','utf8');
 const bootstrap=source.match(/const bootstrap = `([\s\S]*?)`;/)[1].replaceAll('${member}',member);
 const migrations=['20260901_005_sample_color_plate_generator.sql','20260917_001_sample_formulation_foundation.sql','20260917_002_sample_draft_library_identity.sql','20260917_007_sample_formula_mass_balance.sql','20260918_001_sample_formula_historical_parity.sql','20260918_003_sample_formula_volumetric_profiles.sql','20260918_004_sample_formula_density_profiles.sql','20260923160000_sample_operational_profiles.sql'];
 sql(name,bootstrap+migrations.map(f=>readFileSync('supabase/migrations/'+f,'utf8')).join('\n')+`insert into app_users values('${admin}','Local review Admin','admin',true);`);
 if(applyBatch){sql(name,readFileSync('supabase/migrations/'+migration,'utf8'));sql(name,readFileSync('supabase/migrations/'+referenceMigration,'utf8'));}
}
export function provision(name){const row=JSON.parse(sql(name,"select row_to_json(p) from sample_operational_profiles p where name='MTT'"));const operation=readFileSync('supabase/operations/sample-batch/provision-mtt.sql','utf8').replaceAll(":'mtt_id'",literal(row.id)).replaceAll(":'expected_revision'",literal(row.revision));sql(name,asUser(operation));return row.id;}

export function provisionReference(name,id){const revision=sql(name,`select revision from sample_operational_profiles where id=${literal(id)}`);sql(name,asUser(readFileSync('supabase/operations/sample-batch/provision-mtt-reference-thickness.sql','utf8').replaceAll(":'mtt_id'",literal(id)).replaceAll(":'expected_revision'",literal(revision))));}
