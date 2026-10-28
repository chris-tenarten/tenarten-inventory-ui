begin;
do $$declare v text[];begin
 select array_agg(c.value order by c.value) into v from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)c(value) where r.rolname='authenticator' and s.setdatabase=(select oid from pg_database where datname='postgres') and split_part(c.value,'=',1)=any(array['auto_explain.log_min_duration','auto_explain.log_parameter_max_length','log_parameter_max_length','log_statement','log_duration','log_min_error_statement']::text[]);
 if v is distinct from(select array_agg(x order by x) from unnest(array['auto_explain.log_min_duration=-1','auto_explain.log_parameter_max_length=0','log_parameter_max_length=0','log_statement=none','log_duration=on','log_min_error_statement=panic']::text[])x) then raise exception 'API profile drift; do not overwrite';end if;
end;$$;
alter role authenticator in database postgres reset auto_explain.log_min_duration;
alter role authenticator in database postgres reset auto_explain.log_parameter_max_length;
alter role authenticator in database postgres reset log_parameter_max_length;
alter role authenticator in database postgres reset log_statement;
alter role authenticator in database postgres reset log_duration;
alter role authenticator in database postgres reset log_min_error_statement;
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
