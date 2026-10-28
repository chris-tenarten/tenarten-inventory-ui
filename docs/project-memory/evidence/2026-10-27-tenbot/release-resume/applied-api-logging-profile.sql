-- PROPOSED: root first verifies exact rollback-only permission probe.
-- Scoped authenticator/postgres operational config; four accepted migrations remain byte-unchanged.
begin;
do $$begin
 if current_database()<>'postgres' or current_user<>'postgres' then raise exception 'Unexpected logging-profile target';end if;
 if exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)c(value) where r.rolname in('authenticator','anon','authenticated','service_role') and s.setdatabase in(0,(select oid from pg_database where datname=current_database())) and split_part(c.value,'=',1)=any(array['auto_explain.log_min_duration','auto_explain.log_parameter_max_length','log_parameter_max_length','log_statement','log_duration','log_min_error_statement','log_min_duration_statement','log_min_duration_sample','log_transaction_sample_rate','log_parameter_max_length_on_error','pgaudit.log','pgaudit.log_parameter','pgaudit.role','log_error_verbosity']::text[])) then raise exception 'API logging override differs from reviewed absent baseline';end if;
 if current_setting('log_min_duration_statement',true) is distinct from '-1' then raise exception 'Unsafe inherited setting: log_min_duration_statement';end if;
if current_setting('log_min_duration_sample',true) is distinct from '-1' then raise exception 'Unsafe inherited setting: log_min_duration_sample';end if;
if current_setting('log_transaction_sample_rate',true) is distinct from '0' then raise exception 'Unsafe inherited setting: log_transaction_sample_rate';end if;
if current_setting('log_parameter_max_length_on_error',true) is distinct from '0' then raise exception 'Unsafe inherited setting: log_parameter_max_length_on_error';end if;
if current_setting('pgaudit.log',true) is distinct from 'none' then raise exception 'Unsafe inherited setting: pgaudit.log';end if;
if current_setting('pgaudit.log_parameter',true) is distinct from 'off' then raise exception 'Unsafe inherited setting: pgaudit.log_parameter';end if;
if current_setting('pgaudit.role',true) is distinct from '' then raise exception 'Unsafe inherited setting: pgaudit.role';end if;
if current_setting('log_error_verbosity',true) is distinct from 'default' then raise exception 'Unsafe inherited setting: log_error_verbosity';end if;
end;$$;
alter role authenticator in database postgres set auto_explain.log_min_duration='-1';
alter role authenticator in database postgres set auto_explain.log_parameter_max_length='0';
alter role authenticator in database postgres set log_parameter_max_length='0';
alter role authenticator in database postgres set log_statement='none';
alter role authenticator in database postgres set log_duration='on';
alter role authenticator in database postgres set log_min_error_statement='panic';
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
