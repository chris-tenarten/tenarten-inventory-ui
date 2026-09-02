import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const migration=readFileSync('supabase/migrations/20260902_002_bid_proposal_relationships.sql','utf8');
const name=`tenops-bid-context-${process.pid}`;
const image='public.ecr.aws/supabase/postgres:17.6.1.084';
const proposalUser='00000000-0000-0000-0000-000000000001';
const operationalOnly='00000000-0000-0000-0000-000000000002';
const proposalOnly='00000000-0000-0000-0000-000000000003';
const bidA='10000000-0000-0000-0000-000000000001';
const bidB='10000000-0000-0000-0000-000000000002';

assert.doesNotMatch(migration,/insert into public\.jobs|update public\.jobs|delete from public\.jobs/i);
assert.doesNotMatch(migration,/price|total|line_item/i);
assert.match(migration,/grant select on public\.bid_proposal_relationships to authenticated/);
assert.doesNotMatch(migration,/grant select,insert|grant insert/i);

const setup=`
do $$begin if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin;end if;end$$;
create schema if not exists auth;
do $$begin if to_regprocedure('auth.uid()') is null then execute $fn$create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'$fn$;end if;end$$;
create table public.app_users(user_id uuid primary key,is_active boolean not null,proposal_access boolean not null,operational_access boolean not null);
create table public.bids(id uuid primary key,customer text not null,project_name text not null);
create table public.jobs(id uuid primary key);
create table public.proposals(id uuid primary key default gen_random_uuid(),prior_proposal_id uuid references public.proposals(id),created_by_user_id uuid not null references public.app_users(user_id),job_id uuid references public.jobs(id),status text not null default 'draft',customer_name text not null default '',project_name text not null default '',issued_snapshot jsonb);
create table public.samples(id uuid primary key,bid_id uuid references public.bids(id),job_id uuid references public.jobs(id),issued_marker text);
create function public.has_proposal_access() returns boolean language sql stable security definer as $$select exists(select 1 from public.app_users where user_id=auth.uid() and is_active and proposal_access)$$;
create function public.has_app_capability(p text) returns boolean language sql stable security definer as $$select p='readOperationalData' and exists(select 1 from public.app_users where user_id=auth.uid() and is_active and operational_access)$$;
create function public.require_app_capability(p text) returns void language plpgsql security definer as $$begin if not public.has_app_capability(p)then raise exception 'denied' using errcode='42501';end if;end$$;
create function public.create_proposal() returns uuid language plpgsql security definer as $$declare created uuid;begin insert into public.proposals(created_by_user_id)values(auth.uid())returning id into created;return created;end$$;
grant usage on schema public to authenticated;
insert into public.app_users values('${proposalUser}',true,true,true),('${operationalOnly}',true,false,true),('${proposalOnly}',true,true,false);
insert into public.bids values('${bidA}','Acme Customer','Acme Project'),('${bidB}','Other Customer','Other Project');
insert into public.jobs values('20000000-0000-0000-0000-000000000001');
insert into public.proposals(id,created_by_user_id,status,customer_name,project_name,issued_snapshot) values
 ('30000000-0000-0000-0000-000000000001','${proposalUser}','issued','Standalone Customer','Standalone Project','{"fixed":true}');
insert into public.samples values
 ('40000000-0000-0000-0000-000000000001',null,null,'issued-history-unchanged'),
 ('40000000-0000-0000-0000-000000000002','${bidB}',null,'other-bid-history');
`;

const tests=`
select set_config('request.jwt.claim.sub','${proposalUser}',false);
select public.create_bid_proposal('${bidA}');
do $$begin
 if not exists(select 1 from public.proposals p join public.bid_proposal_relationships r on r.proposal_id=p.id where r.bid_id='${bidA}' and p.customer_name='Acme Customer' and p.project_name='Acme Project' and p.job_id is null)then raise exception 'Bid Proposal context incorrect';end if;
 if(select count(*) from public.jobs)<>1 then raise exception 'Production Job changed';end if;
end$$;
select public.link_proposal_to_bid('${bidA}','30000000-0000-0000-0000-000000000001');
do $$begin
 if(select issued_snapshot from public.proposals where id='30000000-0000-0000-0000-000000000001')<>'{"fixed":true}'::jsonb then raise exception 'Issued snapshot changed';end if;
end$$;
insert into public.proposals(prior_proposal_id,created_by_user_id,status) values('30000000-0000-0000-0000-000000000001','${proposalUser}','draft');
do $$begin if not exists(select 1 from public.proposals p join public.bid_proposal_relationships r on r.proposal_id=p.id where p.prior_proposal_id='30000000-0000-0000-0000-000000000001' and r.bid_id='${bidA}')then raise exception 'Revision lost Bid relationship';end if;end$$;
select public.link_sample_to_bid('${bidA}','40000000-0000-0000-0000-000000000001');
do $$begin
 if not exists(select 1 from public.samples where id='40000000-0000-0000-0000-000000000001' and bid_id='${bidA}' and job_id is null and issued_marker='issued-history-unchanged')then raise exception 'Sample context changed unrelated state';end if;
 begin perform public.link_sample_to_bid('${bidA}','40000000-0000-0000-0000-000000000002');raise exception 'Cross-Bid move allowed';exception when unique_violation then null;end;
end$$;
set role authenticated;
do $$begin begin insert into public.bid_proposal_relationships values('${bidA}',gen_random_uuid(),'${proposalUser}',now());raise exception 'Direct relationship insert allowed';exception when insufficient_privilege then null;end;end$$;
reset role;
select set_config('request.jwt.claim.sub','${operationalOnly}',false);
do $$begin begin perform public.create_bid_proposal('${bidA}');raise exception 'Operational-only Proposal creation allowed';exception when insufficient_privilege then null;end;end$$;
set role authenticated;
do $$begin if(select count(*) from public.bid_proposal_relationships)<>0 then raise exception 'Operational-only relationship visibility leaked';end if;end$$;
reset role;
select set_config('request.jwt.claim.sub','${proposalOnly}',false);
do $$begin begin perform public.link_proposal_to_bid('${bidA}','30000000-0000-0000-0000-000000000001');raise exception 'Proposal-only Bid link allowed';exception when insufficient_privilege then null;end;end$$;
do $$begin if(select count(*) from public.jobs)<>1 then raise exception 'Production records changed';end if;end$$;
`;

function run(args,input){const result=spawnSync('docker',args,{input,encoding:'utf8'});if(result.status!==0)throw new Error(`${result.stdout}\n${result.stderr}`);return result.stdout;}
try{
 run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres',image]);
 for(let attempt=0;attempt<40;attempt++){
  if(spawnSync('docker',['exec',name,'pg_isready','-U','postgres']).status===0)break;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);
  if(attempt===39)throw new Error('Disposable PostgreSQL did not become ready.');
 }
 run(['exec','-e','PGPASSWORD=postgres','-i',name,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],setup+migration+tests);
 console.log('Bid contextual generator relationship checks passed.');
}finally{spawnSync('docker',['stop',name]);}
