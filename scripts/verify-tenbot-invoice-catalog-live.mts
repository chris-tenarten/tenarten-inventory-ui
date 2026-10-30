/** Fixed read-only catalog evidence. Execute only after review with the explicit
 * --authorized-readonly-data flag. Shared catalog rows stay in a private scratch
 * file; the printed/saved summary contains only counts, hashes and safe metadata.
 * Management transport replay is NOT hosted caller-JWT/RLS/runtime proof.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createCallerInvoiceReader,InvoiceReadError,type InvoiceCatalogIdentity} from '../supabase/functions/_shared/tenbot-invoice';
import type {JobToolCaller} from '../supabase/functions/_shared/tenbot-job-tools';
import {combinePurchasingCatalogRecords} from '../src/modules/purchasing/catalog-records';
import {fixtureEmployee,fixtureHttpCalls,RECEIVAL_ACTOR_CONFIG,RECEIVAL_FIXTURE_REF} from './support/tenbot-receival-fixture.mjs';

const SHARED_REF='vxdxjhazkqhpkwdqtobp';
const DIRECTORY='/private/tmp/tenops-tenbot-invoice-init-fix-20261030';
const PRIVATE_FIXTURE=DIRECTORY+'/catalog-live.private.json';
const SUMMARY=DIRECTORY+'/catalog-live-summary.json';
const HELPER='/Users/chrisngo/source/repos/tenarten-inventory-ui/.tmp-messaging-groups-release/lib.mjs';
const STANDARD_COLUMNS='id,vendor,vendor_sku,item_name,size,category,material_class,unit';
const SPECIALTY_COLUMNS='id,vendor_name,vendor_sku,item_name,canonical_item_name,size,canonical_size,category,material_type,packaging,unit_size,unit_size_uom,price_unit,is_active';
const EXPECTED={standard:1951,specialty:301};
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const encode=(value:unknown)=>JSON.stringify(value);
type Row=Record<string,unknown>;
type Catalog={standard:Row[];specialty:Row[]};
type Table='vendor_catalog'|'vendor_catalog_v2';
type Page={table:Table;from:number;to:number;returned:number;count:number;scope:'all'|'ids'|'search'};
const object=(value:unknown):value is Row=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const columnsFor=(table:Table)=>table==='vendor_catalog'?STANDARD_COLUMNS:SPECIALTY_COLUMNS;
const sourceFor=(table:Table)=>table==='vendor_catalog'?'standard':'specialty';
const TABLES:readonly Table[]=['vendor_catalog','vendor_catalog_v2'];
const edgePins={TENBOT_RECEIVAL_PILOT_ENABLED:'false',TENBOT_RECEIVAL_EXECUTION_ENABLED:'false',TENBOT_RECEIVAL_EMPLOYEE_IDS:'',TENBOT_RECEIVAL_PILOT_EXPIRES_AT:''};

// All SQL below is a fixed READ ONLY transaction. No supplied SQL, project,
// table, column, caller identity or business record ID can enter this script.
const STATE_SQL=`begin read only;
set local statement_timeout='8s';
select jsonb_build_object(
 'readOnly',current_setting('transaction_read_only'),
 'pilot',(select enabled from public.tenbot_receival_pilot_policy where singleton),
 'execution',(select execution_enabled from public.tenbot_receival_execution_control where singleton),
 'enrolled',(select count(*) from public.tenbot_receival_pilot_employees),
 'grants',(select count(*) from public.tenbot_chris_dev_canary_grants),
 'revokedGrants',(select count(*) from public.tenbot_chris_dev_canary_grants where revoked_at is not null),
 'activeGrants',(select count(*) from public.tenbot_chris_dev_canary_grants where revoked_at is null and expires_at>clock_timestamp()),
 'grantAuditRows',(select count(*) from public.tenbot_chris_dev_canary_grant_audit),
 'permits',(select count(*) from public.invoice_receival_execution_permits),
 'standardCount',(select count(*) from public.vendor_catalog),
 'activeSpecialtyCount',(select count(*) from public.vendor_catalog_v2 where is_active=true),
 'tableMetadata',(select jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'authenticatedSelect',has_table_privilege('authenticated',c.oid,'SELECT'),'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),'serviceRoleSelect',has_table_privilege('service_role',c.oid,'SELECT')) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('vendor_catalog','vendor_catalog_v2'))
) as state;
commit;`;
const CAPTURE_SQL=`begin transaction isolation level repeatable read read only;
set local statement_timeout='8s';
select jsonb_build_object(
 'readOnly',current_setting('transaction_read_only'),
 'standard',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from (select ${STANDARD_COLUMNS} from public.vendor_catalog order by id limit 5001) c),'[]'::jsonb),
 'specialty',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from (select ${SPECIALTY_COLUMNS} from public.vendor_catalog_v2 where is_active=true order by id limit 5001) c),'[]'::jsonb)
) as capture;
commit;`;

let phase='authorization',token:string|undefined,managementCalls=0,pre:Row|undefined,post:Row|undefined;
let secretPre:Row|undefined,secretPost:Row|undefined;
const safeError=(error:unknown)=>error instanceof InvoiceReadError?'INVOICE_READ_'+error.reason.toUpperCase():'READONLY_CATALOG_EVIDENCE_FAILED';
function save(name:string,value:unknown){writeFileSync(name,encode(value)+'\n',{mode:0o600,flag:'wx'});}
function privateDirectory(){
 if(!existsSync(DIRECTORY))mkdirSync(DIRECTORY,{mode:0o700});
 const stat=lstatSync(DIRECTORY);
 assert(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid?.()&&(stat.mode&0o077)===0,'Owner-only scratch directory required');
 assert(!existsSync(PRIVATE_FIXTURE)&&!existsSync(SUMMARY),'Existing evidence requires reconciliation before another capture');
}
async function management(path:'database/query'|'secrets',query?:string):Promise<unknown>{
 assert(token&&path==='secrets'&&query===undefined||token&&path==='database/query'&&[STATE_SQL,CAPTURE_SQL].includes(query??''),'Fixed read-only endpoint required');
 managementCalls++;
 const response=await fetch(`https://api.supabase.com/v1/projects/${SHARED_REF}/${path}`,{
  method:query?'POST':'GET',headers:{Authorization:'Bearer '+token,...(query?{'Content-Type':'application/json'}:{})},
  ...(query?{body:JSON.stringify({query})}:{}),signal:AbortSignal.timeout(15000),redirect:'error',
 });
 assert(response.ok,'Read-only Management request rejected');
 return response.json();
}
async function state():Promise<Row>{
 const rows=await management('database/query',STATE_SQL);
 assert(Array.isArray(rows),'Read-only state envelope required');
 const value=rows.find(row=>object(row)&&object(row.state))?.state;
 assert(object(value)&&value.readOnly==='on','Read-only transaction required');
 return value;
}
async function edgeState():Promise<Row>{
 const rows=await management('secrets');assert(Array.isArray(rows),'Digest-only secret metadata required');
 const pins:Row={};
 for(const [name,value] of Object.entries(edgePins)){
  const selected=rows.find(row=>object(row)&&row.name===name);
  assert(object(selected),'Gate digest metadata is required');
  const digest=selected.digest??selected.value;
  assert(typeof digest==='string'&&/^[a-f0-9]{64}$/.test(digest),'Only digest metadata is accepted');
  assert(digest===sha(value),'Dormant Edge gate or enrollment differs');pins[name]=digest;
 }
 return pins;
}
function dormant(value:Row){
 assert.equal(value.pilot,false,'SQL pilot must remain OFF');assert.equal(value.execution,false,'SQL execution must remain OFF');
 for(const name of ['enrolled','activeGrants','permits'])assert.equal(value[name],0,'Dormant grant/enrollment/permit required');
 assert.equal(value.grants,1,'Exactly the known historical grant must remain');assert.equal(value.revokedGrants,1,'The historical grant must remain revoked');
 assert.equal(value.grantAuditRows,2,'Activation and revocation audit must remain');
 assert.equal(value.standardCount,EXPECTED.standard,'Shared standard count changed; stop and review');
 assert.equal(value.activeSpecialtyCount,EXPECTED.specialty,'Shared active specialty count changed; stop and review');
 assert(Array.isArray(value.tableMetadata)&&value.tableMetadata.length===2,'Both table metadata rows required');
 for(const table of value.tableMetadata){assert(object(table)&&table.authenticatedSelect===true,'Existing authenticated catalog SELECT required');}
}
function verifyProjection(rows:unknown,columns:string):asserts rows is Row[]{
 assert(Array.isArray(rows),'Catalog array required');
 const allowed=columns.split(',').sort();
 for(const row of rows)assert(object(row)&&encode(Object.keys(row).sort())===encode(allowed),'Exact price-free source projection required');
}

/** A Supabase-shaped transport replay over private captured rows. It checks the
 * real reader's page/filter/projection contract; it cannot prove RLS or SQL LIKE
 * semantics. No RPC or mutation method exists on this replay caller. */
function replayCaller(catalog:Catalog){
 const pages:Page[]=[];
 const caller={
  from(selected:string){
   assert(TABLES.includes(selected as Table),'Catalog-only replay required');const table=selected as Table;
   return {select(columns:string,options:{count:'exact'}){
    assert.equal(columns,columnsFor(table),'Canonical price-free projection required');assert.equal(options.count,'exact');
    let from=0,to=249,ids:readonly unknown[]|undefined,search:{column:string;term:string}[]|undefined,activeOnly=false;
    let abort:AbortSignal|undefined;
    const query={
     eq(column:string,value:unknown){assert(table==='vendor_catalog_v2'&&column==='is_active'&&value===true);activeOnly=true;return query;},
     in(column:string,values:readonly unknown[]){assert.equal(column,'id');ids=values;return query;},
     or(filter:string){
      const matches=[...filter.matchAll(/(?:^|,)([a-z_]+)\.ilike\.("(?:\\.|[^"\\])*")/g)];
      assert(matches.length>0&&matches.map(match=>match[0]).join('')===filter,'Fixed escaped catalog search grammar required');
      search=matches.map(match=>{assert(columns.split(',').includes(match[1]));const pattern=JSON.parse(match[2]) as string;assert(pattern.startsWith('%')&&pattern.endsWith('%'));return {column:match[1],term:pattern.slice(1,-1).replace(/\\([\\%_])/g,'$1').toLocaleLowerCase('en-US')};});return query;
     },
     order(column:string){assert.equal(column,'id');return query;},
     range(first:number,last:number){assert(Number.isSafeInteger(first)&&Number.isSafeInteger(last)&&first>=0&&last>=first&&last-first<250,'At most 250 rows per transport page');from=first;to=last;return query;},
     abortSignal(signal:AbortSignal){abort=signal;return query;},
     then(resolve:(value:unknown)=>unknown,reject?:(error:unknown)=>unknown){
      assert(abort&&!abort.aborted,'Active whole-read signal required');
      const source=catalog[sourceFor(table)];
      const rows=source.filter(row=>(!activeOnly||row.is_active===true)&&(!ids||ids.includes(row.id))&&(!search||search.some(part=>typeof row[part.column]==='string'&&(row[part.column] as string).toLocaleLowerCase('en-US').includes(part.term))));
      const selectedRows=rows.slice(from,to+1).map(row=>Object.fromEntries(columns.split(',').map(column=>[column,row[column]??null])));
      pages.push({table,from,to,returned:selectedRows.length,count:rows.length,scope:ids?'ids':search?'search':'all'});
      return Promise.resolve({data:selectedRows,count:rows.length,error:null}).then(resolve,reject);
     },
    };return query;
   }};
  },
  rpc(){throw new Error('No RPC is permitted by catalog transport replay');},
 } as unknown as JobToolCaller;
 return {caller,pages};
}
function searchMatches(catalog:Catalog,term:string){
 const normalized=term.toLocaleLowerCase('en-US');
 return TABLES.reduce((total,table)=>total+catalog[sourceFor(table)].filter(row=>columnsFor(table).split(',').filter(column=>table==='vendor_catalog'?['item_name','vendor_sku','vendor','size'].includes(column):['item_name','canonical_item_name','vendor_sku','vendor_name','size','canonical_size'].includes(column)).some(column=>typeof row[column]==='string'&&(row[column] as string).toLocaleLowerCase('en-US').includes(normalized))).length,0);
}
async function replay(catalog:Catalog){
 const transport=replayCaller(catalog),reader=createCallerInvoiceReader(transport.caller);
 const full=await reader.readCatalog!(AbortSignal.timeout(4000));
 assert.equal(full.complete,true);assert.equal(full.standard.length,EXPECTED.standard);assert.equal(full.specialty.length,EXPECTED.specialty);
 assert.deepEqual(full.standard,catalog.standard);assert.deepEqual(full.specialty,catalog.specialty);
 const canonical=combinePurchasingCatalogRecords(catalog.standard,catalog.specialty);
 assert.deepEqual(combinePurchasingCatalogRecords(full.standard,full.specialty),canonical,'Canonical supplier/category/package mapper must remain identical');
 const fullPages=transport.pages.splice(0);
 assert(fullPages.some(page=>page.table==='vendor_catalog'&&page.from>=1000),'Actual shared shape must traverse beyond the former bound');
 const late=catalog.standard.slice(1000).map((row,index)=>({row,index:index+1000,terms:[row.vendor_sku,row.item_name].filter((value):value is string=>typeof value==='string'&&value.trim().length>=2&&value.trim().length<=160)})).find(candidate=>candidate.terms.some(term=>searchMatches(catalog,term.trim())<=1000));
 assert(late&&typeof late.row.id==='string','A usable actual catalog identity beyond position 1000 is required');
 const identities:InvoiceCatalogIdentity[]=[{source:'standard',id:late.row.id}];
 const selected=await reader.readCatalog!(AbortSignal.timeout(4000),identities);
 assert.deepEqual(selected.standard,[late.row]);assert.equal(selected.specialty.length,0);
 const selectedPages=transport.pages.splice(0);
 assert(selectedPages.every(page=>page.scope==='ids'&&page.count===1),'Selected identity must be filtered before complete read');
 const term=late.terms.find(candidate=>searchMatches(catalog,candidate.trim())<=1000)!.trim();
 const searched=await reader.searchCatalog(term,AbortSignal.timeout(4000));
 assert(searched.complete&&searched.standard.some(row=>row.id===late.row.id),'Late existing material must remain searchable');
 const searchPages=transport.pages.splice(0);
 assert(searchPages.every(page=>page.scope==='search'&&page.count<=1000),'Model search remains bounded');
 return {passed:true,scope:'Actual shared rows replayed through the new reader; no live JWT/RLS or hosted runtime proof',counts:{standard:full.standard.length,specialty:full.specialty.length,mapped:canonical.length},fullPages,selectedPages,searchPages,lateRowPosition:late.index+1,lateIdentitySha256:sha(late.row.id),searchTermSha256:sha(term),mapperSha256:sha(encode(canonical))};
}
async function signedFixture(){
 assert.equal(RECEIVAL_FIXTURE_REF,'jltgxcfiprocydhbrahz');assert.notEqual(RECEIVAL_FIXTURE_REF,SHARED_REF);
 process.env.TENBOT_RECEIVAL_FIXTURE_CONFIG=RECEIVAL_ACTOR_CONFIG;
 const before=fixtureHttpCalls(),signed=await fixtureEmployee('employeeA');
 const verified=await signed.client.auth.getUser(signed.jwt);
 assert(!verified.error&&verified.data.user?.id===signed.id,'Existing synthetic signed caller verification required');
 const catalog=await createCallerInvoiceReader(signed.client as unknown as JobToolCaller).readCatalog!(AbortSignal.timeout(8000));
 assert(catalog.complete===true,'Signed fixture complete catalog required');
 verifyProjection(catalog.standard,STANDARD_COLUMNS);verifyProjection(catalog.specialty,SPECIALTY_COLUMNS);
 const canonical=combinePurchasingCatalogRecords(catalog.standard,catalog.specialty);
 return {passed:true,fixtureRef:RECEIVAL_FIXTURE_REF,actualSignedJwt:true,verifiedUserSha256:sha(signed.id),counts:{standard:catalog.standard.length,specialty:catalog.specialty.length,mapped:canonical.length},catalogSha256:sha(encode(catalog)),httpCalls:fixtureHttpCalls()-before,scope:'Actual existing synthetic Auth/PostgREST SELECT only. Its smaller record count is not a live 1951-row caller test.',setupCalls:0,fixtureSqlCalls:0,businessMutations:0,modelCalls:0};
}

async function main(){
 assert.deepEqual(process.argv.slice(2),['--authorized-readonly-data'],'Explicit fixed read-only data authorization required');privateDirectory();
 const helper=await import(pathToFileURL(HELPER).href) as {supabaseToken():string};token=helper.supabaseToken();
 let result:Row|undefined;
 try{
  phase='shared-precheck';[pre,secretPre]=await Promise.all([state(),edgeState()]);dormant(pre);
  phase='private-catalog-capture';const reply=await management('database/query',CAPTURE_SQL);assert(Array.isArray(reply));
  const capture=reply.find(row=>object(row)&&object(row.capture))?.capture;assert(object(capture)&&capture.readOnly==='on');
  verifyProjection(capture.standard,STANDARD_COLUMNS);verifyProjection(capture.specialty,SPECIALTY_COLUMNS);
  const catalog:Catalog={standard:capture.standard,specialty:capture.specialty};assert.equal(catalog.standard.length,EXPECTED.standard);assert.equal(catalog.specialty.length,EXPECTED.specialty);
  save(PRIVATE_FIXTURE,{capturedAt:new Date().toISOString(),sharedRef:SHARED_REF,transport:'Management API / fixed READ ONLY projection; not caller-JWT evidence',standardColumns:STANDARD_COLUMNS,specialtyColumns:SPECIALTY_COLUMNS,...catalog});
  assert.equal(lstatSync(PRIVATE_FIXTURE).mode&0o777,0o600,'Captured catalog must remain owner-only');
  phase='actual-shape-transport-replay';const replayResult=await replay(catalog);
  phase='existing-signed-synthetic-caller-read';const fixtureResult=await signedFixture();
  result={passed:true,recordedAt:new Date().toISOString(),sharedRef:SHARED_REF,sharedMetadataReadOnly:true,expectedCounts:EXPECTED,capturedCounts:{standard:catalog.standard.length,specialty:catalog.specialty.length},privateFixtureSha256:sha(readFileSync(PRIVATE_FIXTURE)),sourceHashes:{reader:sha(readFileSync('supabase/functions/_shared/tenbot-invoice.ts')),mapper:sha(readFileSync('src/modules/purchasing/catalog-records.ts'))},replay:replayResult,signedFixture:fixtureResult,sharedTableMetadata:pre.tableMetadata,failedHostedRequestReproduced:false,limitations:['The original failed hosted request status/body/request ID was not captured.','Pilot-OFF 403 is authorization evidence, not reproduction of the catalog branch.','Management data replay verifies the actual catalog shape through the reader; it does not prove shared caller authorization/RLS or PostgREST search semantics.','The genuine synthetic JWT read uses existing fixture rows only, with no setup or record writes; cardinality may be much smaller than shared data.','No hosted invoice upload, model call, grant activation, enrollment, approval or execution is attempted.'],businessMutations:0,grantMutations:0,modelCalls:0};
 }finally{
  if(pre){const operationPhase=phase;phase='shared-postcheck';[post,secretPost]=await Promise.all([state(),edgeState()]);dormant(post);assert.deepEqual(post,pre,'Shared dormant metadata or catalog counts changed');assert.deepEqual(secretPost,secretPre,'Edge dormant configuration changed');phase=operationPhase;}
  token=undefined;
 }
 assert(result&&pre&&post);result.managementCalls=managementCalls;result.sharedPrePostSha256=sha(encode(pre));result.sharedDormantStatePreserved=true;
 save(SUMMARY,result);console.log(encode(result));
}
main().catch(error=>{
 token=undefined;
 const failure={passed:false,recordedAt:new Date().toISOString(),phase,code:safeError(error),automaticRetry:false,businessMutations:0,grantMutations:0,modelCalls:0,sharedPrecheckCompleted:Boolean(pre),sharedPostcheckCompleted:Boolean(post)};
 if(existsSync(DIRECTORY)){const stat=lstatSync(DIRECTORY);if(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid?.()&&(stat.mode&0o077)===0)save(DIRECTORY+'/catalog-live-stop-'+Date.now()+'.json',failure);}
 console.error(encode(failure));process.exitCode=1;
});
