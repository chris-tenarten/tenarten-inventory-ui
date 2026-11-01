-- Synthetic records only for fixed isolated fixture jltgxcfiprocydhbrahz.
-- Prerequisite minimal read tables/policies are checked by the validator.
begin;
insert into public.jobs(id,name,job_number,customer,production_status,material_status,planned_start,planned_end,archived_at) values
('11902026-0000-4000-8000-000000000001','Synthetic Live History Alpha','HIST-1','Synthetic','in_production','ready','2026-11-01','2026-11-10',null),
('11902026-0000-4000-8000-000000000002','Synthetic Live History Deck','HIST-2','Synthetic','on_deck','not_ready','2026-11-01','2026-11-10',null),
('11902026-0000-4000-8000-000000000003','Synthetic Live History Hold','HIST-3','Synthetic','on_hold','unknown','2026-11-01','2026-11-10',null),
('11902026-0000-4000-8000-000000000004','Synthetic Live History Rework','HIST-4','Synthetic','complete','ready','2026-11-01','2026-11-10',null),
('11902026-0000-4000-8000-000000000005','Synthetic Live History Archived','HIST-5','Synthetic','in_production','ready','2026-11-01','2026-11-10',now());
insert into public.production_rework_cycles values('11902026-0000-4000-8000-000000000104','11902026-0000-4000-8000-000000000004',1,'in_production','2026-11-01','2026-11-10',now());
insert into public.manpower_entries values('11902026-0000-4000-8000-000000000201','11902026-0000-4000-8000-000000000001',null,'2026-11-01',3,2,now());
commit;
