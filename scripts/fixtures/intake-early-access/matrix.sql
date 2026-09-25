-- Disposable PostgreSQL only. No business fixtures remain after the probes.
select public.test_measure_job_access('after');
do $$begin
 if (select count(*) from test_job_access_results where result='allowed')<>70 or exists(
 select 1 from test_job_access_results b join test_job_access_results a on a.actor=b.actor and a.operation=b.operation and a.stage='after'
 where b.stage='before' and b.result<>a.result) then raise exception 'Normal Production operation regression';end if;
 if to_regclass('public.intake_training_workflows') is not null or to_regprocedure('public.create_personal_test_bid()') is not null or to_regprocedure('public.reset_personal_test_workflow(uuid,text,text)') is not null or to_regprocedure('public.has_intake_training_access()') is not null then raise exception 'Training remains';end if;
end$$;
create function public.test_denied(q text,expected text default '42501') returns void language plpgsql as $$begin
 begin execute q;exception when others then if sqlstate=expected then return;end if;raise;end;
 raise exception 'Expected denial %: %',expected,q;
end$$;
-- ROLE_MATRIX

begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$begin if (select count(*) from list_bids())<>8 then raise exception 'Intake read failed';end if;end$$;
select test_denied('insert into bids(customer,project_name,owner_user_id,creator_user_id) values(''TEST'',''TEST'',auth.uid(),auth.uid())');
select test_denied('update bids set project_name=''Raw bypass''');
select test_denied('delete from bids');
select test_denied('delete from jobs');
select create_bid('TEST synthetic','TEST ordinary workflow') as created \gset
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'active',null,'','','','');
select create_bid_update(:'created','Synthetic update');
select set_bid_projected_window(:'created','2026-10-01','2026-10-05',(select updated_at from bids where id=:'created'));
select test_denied(format('select set_bid_projected_window(%L,null,null,%L)',:'created','2000-01-01'),'40001');
select file_id,storage_path from begin_bid_file_upload(:'created','fixture.pdf','application/pdf',10) \gset
select test_denied(format('insert into storage.objects(bucket_id,name,metadata) values(%L,%L,%L)','bid-files','unregistered-path','{}'));
insert into storage.objects(bucket_id,name,metadata) values('bid-files',:'storage_path','{"size":10}');
select finalize_bid_file_upload(:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select cancel_bid_file_removal(:'created',:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select test_denied(format('select finalize_bid_file_removal(%L,%L)',:'created',:'file_id'),'55000');
delete from storage.objects where bucket_id='bid-files' and name=:'storage_path';
select finalize_bid_file_removal(:'created',:'file_id');
select test_denied(format('select convert_bid_to_production(%L,(select updated_at from bids where id=%L),%L)',:'created',:'created','unscheduled'),'22023');
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'won','2026-09-25','','','','');
select convert_bid_to_production(:'created',(select updated_at from bids where id=:'created'),'carry') as converted \gset
select convert_bid_to_production(:'created',(select updated_at from bids where id=:'created'),'unscheduled')=:'converted'::uuid as same_job \gset
\if :same_job
\else
\quit 3
\endif
do $$begin if (select count(*) from jobs)<>2 then raise exception 'Duplicate conversion';end if;end$$;
select test_denied(format('select prepare_admin_delete_bid(%L)',:'created'),'23503');
select create_bid('TEST','Delete eligible') as empty_bid \gset
select prepare_admin_delete_bid(:'empty_bid');
select admin_permanently_delete_bid(:'empty_bid','Delete eligible');
rollback;select 'PASS: admin ordinary edits/files/windows, guarded conversion/deletion';

begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$begin if (select count(*) from list_bids())<>8 then raise exception 'Intake read failed';end if;end$$;
select test_denied('insert into bids(customer,project_name,owner_user_id,creator_user_id) values(''TEST'',''TEST'',auth.uid(),auth.uid())');
select test_denied('update bids set project_name=''Raw bypass''');
select test_denied('delete from bids');
select test_denied('delete from jobs');
select create_bid('TEST synthetic','TEST ordinary workflow') as created \gset
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'active',null,'','','','');
select create_bid_update(:'created','Synthetic update');
select set_bid_projected_window(:'created','2026-10-01','2026-10-05',(select updated_at from bids where id=:'created'));
select test_denied(format('select set_bid_projected_window(%L,null,null,%L)',:'created','2000-01-01'),'40001');
select file_id,storage_path from begin_bid_file_upload(:'created','fixture.pdf','application/pdf',10) \gset
select test_denied(format('insert into storage.objects(bucket_id,name,metadata) values(%L,%L,%L)','bid-files','unregistered-path','{}'));
insert into storage.objects(bucket_id,name,metadata) values('bid-files',:'storage_path','{"size":10}');
select finalize_bid_file_upload(:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select cancel_bid_file_removal(:'created',:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select test_denied(format('select finalize_bid_file_removal(%L,%L)',:'created',:'file_id'),'55000');
delete from storage.objects where bucket_id='bid-files' and name=:'storage_path';
select finalize_bid_file_removal(:'created',:'file_id');
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'won','2026-09-25','','','','');
select test_denied(format('select convert_bid_to_production(%L,(select updated_at from bids where id=%L),%L)',:'created',:'created','unscheduled'));
select test_denied(format('select prepare_admin_delete_bid(%L)',:'created'));
select test_denied('select admin_permanently_delete_production_job(''90000000-0000-4000-8000-000000000001'',''Protected ordinary Job'')');
rollback;select 'PASS: developer ordinary edits/files/windows, guarded conversion/deletion';

begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$begin if (select count(*) from list_bids())<>8 then raise exception 'Intake read failed';end if;end$$;
select test_denied('insert into bids(customer,project_name,owner_user_id,creator_user_id) values(''TEST'',''TEST'',auth.uid(),auth.uid())');
select test_denied('update bids set project_name=''Raw bypass''');
select test_denied('delete from bids');
select test_denied('delete from jobs');
select create_bid('TEST synthetic','TEST ordinary workflow') as created \gset
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'active',null,'','','','');
select create_bid_update(:'created','Synthetic update');
select set_bid_projected_window(:'created','2026-10-01','2026-10-05',(select updated_at from bids where id=:'created'));
select test_denied(format('select set_bid_projected_window(%L,null,null,%L)',:'created','2000-01-01'),'40001');
select file_id,storage_path from begin_bid_file_upload(:'created','fixture.pdf','application/pdf',10) \gset
select test_denied(format('insert into storage.objects(bucket_id,name,metadata) values(%L,%L,%L)','bid-files','unregistered-path','{}'));
insert into storage.objects(bucket_id,name,metadata) values('bid-files',:'storage_path','{"size":10}');
select finalize_bid_file_upload(:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select cancel_bid_file_removal(:'created',:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select test_denied(format('select finalize_bid_file_removal(%L,%L)',:'created',:'file_id'),'55000');
delete from storage.objects where bucket_id='bid-files' and name=:'storage_path';
select finalize_bid_file_removal(:'created',:'file_id');
select test_denied(format('select convert_bid_to_production(%L,(select updated_at from bids where id=%L),%L)',:'created',:'created','unscheduled'),'22023');
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'won','2026-09-25','','','','');
select convert_bid_to_production(:'created',(select updated_at from bids where id=:'created'),'carry') as converted \gset
select convert_bid_to_production(:'created',(select updated_at from bids where id=:'created'),'unscheduled')=:'converted'::uuid as same_job \gset
\if :same_job
\else
\quit 3
\endif
do $$begin if (select count(*) from jobs)<>2 then raise exception 'Duplicate conversion';end if;end$$;
select test_denied(format('select prepare_admin_delete_bid(%L)',:'created'));
select test_denied('select admin_permanently_delete_production_job(''90000000-0000-4000-8000-000000000001'',''Protected ordinary Job'')');
rollback;select 'PASS: lead ordinary edits/files/windows, guarded conversion/deletion';

begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $$begin if (select count(*) from list_bids())<>8 then raise exception 'Intake read failed';end if;end$$;
select test_denied('insert into bids(customer,project_name,owner_user_id,creator_user_id) values(''TEST'',''TEST'',auth.uid(),auth.uid())');
select test_denied('update bids set project_name=''Raw bypass''');
select test_denied('delete from bids');
select test_denied('delete from jobs');
select create_bid('TEST synthetic','TEST ordinary workflow') as created \gset
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'active',null,'','','','');
select create_bid_update(:'created','Synthetic update');
select set_bid_projected_window(:'created','2026-10-01','2026-10-05',(select updated_at from bids where id=:'created'));
select test_denied(format('select set_bid_projected_window(%L,null,null,%L)',:'created','2000-01-01'),'40001');
select file_id,storage_path from begin_bid_file_upload(:'created','fixture.pdf','application/pdf',10) \gset
select test_denied(format('insert into storage.objects(bucket_id,name,metadata) values(%L,%L,%L)','bid-files','unregistered-path','{}'));
insert into storage.objects(bucket_id,name,metadata) values('bid-files',:'storage_path','{"size":10}');
select finalize_bid_file_upload(:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select cancel_bid_file_removal(:'created',:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select test_denied(format('select finalize_bid_file_removal(%L,%L)',:'created',:'file_id'),'55000');
delete from storage.objects where bucket_id='bid-files' and name=:'storage_path';
select finalize_bid_file_removal(:'created',:'file_id');
select test_denied(format('select convert_bid_to_production(%L,(select updated_at from bids where id=%L),%L)',:'created',:'created','unscheduled'),'22023');
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'won','2026-09-25','','','','');
select test_denied(format('select convert_bid_to_production(%L,(select updated_at from bids where id=%L),%L)',:'created',:'created','carry'));
select convert_bid_to_production(:'created',(select updated_at from bids where id=:'created'),'unscheduled') as converted \gset
select convert_bid_to_production(:'created',(select updated_at from bids where id=:'created'),'unscheduled')=:'converted'::uuid as same_job \gset
\if :same_job
\else
\quit 3
\endif
do $$begin if (select count(*) from jobs)<>2 then raise exception 'Duplicate conversion';end if;end$$;
select test_denied(format('select prepare_admin_delete_bid(%L)',:'created'));
select test_denied('select admin_permanently_delete_production_job(''90000000-0000-4000-8000-000000000001'',''Protected ordinary Job'')');
rollback;select 'PASS: member ordinary edits/files/windows, guarded conversion/deletion';

begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
do $$begin if (select count(*) from list_bids())<>8 then raise exception 'Intake read failed';end if;end$$;
select test_denied('insert into bids(customer,project_name,owner_user_id,creator_user_id) values(''TEST'',''TEST'',auth.uid(),auth.uid())');
select test_denied('update bids set project_name=''Raw bypass''');
select test_denied('delete from bids');
select test_denied('delete from jobs');
select create_bid('TEST synthetic','TEST ordinary workflow') as created \gset
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'active',null,'','','','');
select create_bid_update(:'created','Synthetic update');
select set_bid_projected_window(:'created','2026-10-01','2026-10-05',(select updated_at from bids where id=:'created'));
select test_denied(format('select set_bid_projected_window(%L,null,null,%L)',:'created','2000-01-01'),'40001');
select file_id,storage_path from begin_bid_file_upload(:'created','fixture.pdf','application/pdf',10) \gset
select test_denied(format('insert into storage.objects(bucket_id,name,metadata) values(%L,%L,%L)','bid-files','unregistered-path','{}'));
insert into storage.objects(bucket_id,name,metadata) values('bid-files',:'storage_path','{"size":10}');
select finalize_bid_file_upload(:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select cancel_bid_file_removal(:'created',:'file_id');
select prepare_bid_file_removal(:'created',:'file_id');
select test_denied(format('select finalize_bid_file_removal(%L,%L)',:'created',:'file_id'),'55000');
delete from storage.objects where bucket_id='bid-files' and name=:'storage_path';
select finalize_bid_file_removal(:'created',:'file_id');
select update_bid(:'created','TEST synthetic','Renamed ordinary workflow',auth.uid(),'won','2026-09-25','','','','');
select test_denied(format('select convert_bid_to_production(%L,(select updated_at from bids where id=%L),%L)',:'created',:'created','unscheduled'));
select test_denied(format('select prepare_admin_delete_bid(%L)',:'created'));
select test_denied('select admin_permanently_delete_production_job(''90000000-0000-4000-8000-000000000001'',''Protected ordinary Job'')');
rollback;select 'PASS: guest ordinary edits/files/windows, guarded conversion/deletion';

begin;set local role anon;
select test_denied('select * from bids');
select test_denied('select create_bid(''TEST'',''TEST'')');
select test_denied('select list_bids()');
do $$begin if exists(select 1 from storage.objects where bucket_id='bid-files') then raise exception 'Anonymous file exposure';end if;end$$;
rollback;
begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
select test_denied('select create_bid(''TEST'',''TEST'')');
do $$begin if exists(select 1 from bids) then raise exception 'Inactive read exposure';end if;end$$;
rollback;
begin;set local role service_role;
select count(*) from bids;update bids set notes='Disposable service probe' where id='10000000-0000-4000-8000-000000000001';
rollback;
select 'PASS: 35 Production before/after operation pairs, anonymous/inactive denied, service direct access retained';
