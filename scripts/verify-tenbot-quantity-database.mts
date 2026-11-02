/** Focused TS/SQL parity in the existing fixed synthetic fixture. The new
 * function body and temporary cases roll back; no shared project or inference. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {invoiceQuantityIssues,type InvoiceQuantityOffer} from '../src/modules/inventory/invoice-quantity';
import {fixtureSql,RECEIVAL_FIXTURE_REF} from './support/tenbot-receival-fixture.mjs';
assert(process.argv.length===3&&process.argv[2]==='--authorized-isolated-fixture');
assert.equal(RECEIVAL_FIXTURE_REF,'jltgxcfiprocydhbrahz');
const directory='/private/tmp/tenops-pending-quantity-completion-20261102/database';mkdirSync(directory,{recursive:true});
const migrationPath='supabase/migrations/20261102160000_tenbot_invoice_quantity_total_evidence.sql',migration=readFileSync(migrationPath,'utf8');
const offer:InvoiceQuantityOffer={orderUnit:'Bag',packageQuantity:'50',packageMeasure:'LB',containerType:'Bag'};
type Case={name:string;source:{quantity:string;unit:string};offer:InvoiceQuantityOffer;quantity:string;unit:string;text:string;valid:boolean};
const cases:Case[]=[];
const add=(name:string,text:string,valid:boolean,quantity='1',sourceQuantity='50',sourceUnit='LB',selectedOffer=offer,unit='Bag')=>cases.push({name,text,valid,quantity,unit,source:{quantity:sourceQuantity,unit:sourceUnit},offer:selectedOffer});
add('equal-independent-total','Alaska White | #0 | 50 LB (50 LB Bag)',true);
add('multiple-package-total','Alaska White | #0 | 100 LB (50 LB Bag)',true,'2','100');
for(const factor of ['×','x','at','each'])add('factor-'+factor,'1 Bag '+factor+' 50 LB = 50 LB',true);
add('later-at-factor','50 LB total | 1 Bag @ 50 LB',true);
add('count-source','1 Bag × 50 LB = 50 LB',true,'1','1','Bag');
for(const label of ['50 LB Bag','50 LB/Bag','50 LB-Bag'])add('package-only-'+label,'Package: '+label,false);
add('count-factor-without-total','1 Bag × 50 LB',false);
for(const text of ['50 LB Bag (50 LB)','Package: 50 LB Bag (50 LB)','Package: 50 LB Bag ((50 LB))','Package: 50 LB Bag (50 LB'])add('package-annotation-'+text,text,false);
add('independent-total-with-annotation','50 LB (50 LB Bag) (50 LB)',true);
add('conflicting-total','50 LB (50 LB Bag) | 100 LB',false);
add('conflicting-count','2 Bag × 50 LB = 50 LB',false);
add('conflicting-package','50 LB (25 LB Bag)',false);
add('different-line-package-first','50 LB Bag\nTotal: 50 LB',false);
add('different-line-total-first','Total: 50 LB\r\n50 LB Bag',false);
add('fractional-package','125 LB (50 LB Bag)',false,'2.5','125');
add('nonexact-package','100 LB (3 LB Bag)',false,'33.333333','100','LB',{...offer,packageQuantity:'3'});
add('wrong-expected','50 LB (50 LB Bag)',false,'2');
add('wrong-order-unit','50 LB (50 LB Bag)',false,'1','50','LB',offer,'LB');
add('unsupported-source-unit','50 stones (50 LB Bag)',false,'1','50','stones');
add('missing-source-quantity','50 LB (50 LB Bag)',false,'1','');
for(const row of cases){const actual=invoiceQuantityIssues(row.source,row.offer,row.quantity,row.unit,row.text);assert.equal(actual.reasons.length===0&&actual.basis.receivalQuantity!==null,row.valid,'TS expectation '+row.name);}
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const values=cases.map((row,index)=>`(${index+1},${quote(row.name)},${quote(JSON.stringify(row.source))}::jsonb,${quote(JSON.stringify(row.offer))}::jsonb,${quote(row.quantity)},${quote(row.unit)},${quote(row.text)},${row.valid})`).join(',\n');
const body=migration.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const fingerprint=`jsonb_build_object('stock',(select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,'[]')) from public.inventory_items i),'transactions',(select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,'[]')) from public.inventory_transactions i),'pending',(select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,'[]')) from public.pending_receivals i),'caps',(select md5(coalesce(jsonb_agg(to_jsonb(i) order by role,capability)::text,'[]')) from public.app_role_capabilities i))`;
const query=`begin;set local lock_timeout='3s';set local statement_timeout='30s';
create temp table quantity_before as select ${fingerprint} as fingerprint;
${body}
create temp table quantity_cases(n integer,name text,source jsonb,offer jsonb,quantity text,unit text,source_text text,expected boolean,result jsonb,code text);
insert into quantity_cases(n,name,source,offer,quantity,unit,source_text,expected) values ${values};
do $parity$ declare c record;answer jsonb;v_sqlstate text;begin
 for c in select * from quantity_cases order by n loop
  answer:=null;v_sqlstate:=null;
  begin answer:=public.tenbot_invoice_quantity_basis(c.source,c.offer,c.quantity,c.unit,c.source_text);
  exception when sqlstate '22023' then v_sqlstate:='22023';end;
  update quantity_cases set result=answer,code=v_sqlstate where n=c.n;
 end loop;
end $parity$;
select jsonb_build_object('cases',(select jsonb_agg(jsonb_build_object('name',name,'expected',expected,'result',result,'code',code) order by n) from quantity_cases),'protectedStateUnchanged',(select fingerprint from quantity_before)=${fingerprint},'functionBodyMd5',(select md5(prosrc) from pg_proc where oid='public.tenbot_invoice_quantity_basis(jsonb,jsonb,text,text,text)'::regprocedure)) as parity;
rollback;`;
const rows=fixtureSql('quantity-parity-rollback',query),parity=rows.find(row=>row.parity)?.parity as {cases:{name:string;expected:boolean;result:unknown;code:string|null}[];protectedStateUnchanged:boolean;functionBodyMd5:string};
assert(parity?.protectedStateUnchanged&&parity.cases.length===cases.length);
for(const [index,row]of parity.cases.entries()){const input=cases[index];assert.equal(row.name,input.name);assert.equal(row.code===null,input.valid,'SQL expectation '+row.name);if(input.valid)assert.deepEqual(row.result,invoiceQuantityIssues(input.source,input.offer,input.quantity,input.unit,input.text).basis,'TS/SQL basis '+row.name);else assert.equal(row.code,'22023');}
const restored=fixtureSql('quantity-parity-restored',"begin read only;select md5(prosrc) as body_md5 from pg_proc where oid='public.tenbot_invoice_quantity_basis(jsonb,jsonb,text,text,text)'::regprocedure;commit;");assert.equal(restored[0].body_md5,'c9616fb63241ce96de7c186f8a8c40e2');
const report={passed:true,fixtureRef:RECEIVAL_FIXTURE_REF,groups:cases.length,cases:parity.cases,rollbackRestoredOriginalFunction:true,protectedStateUnchanged:true,newFunctionBodyMd5:parity.functionBodyMd5,migration:{path:migrationPath,sha256:createHash('sha256').update(migration).digest('hex'),sharedApplied:false,fixturePersisted:false},actualPostgreSQL:true,actualInference:false,sharedProjectCalls:0};writeFileSync(directory+'/quantity-parity.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));
