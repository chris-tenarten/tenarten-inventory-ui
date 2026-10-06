-- Prospective tolerant identifiers only. No row updates, uniqueness rule, or capture changes.
begin;
do $migration$
declare f record; definition text; changed integer:=0;
 strict_guard text := $guard$if color_plate is not null and color_plate !~ '^T[0-9]{2}-[0-9]{3}[A-Z]$' then raise exception 'New Color Plate numbers must use TYY-NNNL format, for example T26-123A.' using errcode='22023'; end if;$guard$;
 normalized text := $expression$nullif(upper(btrim(coalesce(p_sample->>'color_plate_number',''))),'')$expression$;
begin
 -- Include retained legacy save implementations reached by the current dispatcher.
 -- Replace only the identifier guard and identifier initialization; all formulation logic stays intact.
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'save_sample_draft%'
 loop
   definition:=pg_get_functiondef(f.oid);
   if strpos(definition,strict_guard)=0 then continue; end if;
   if strpos(definition,normalized)=0 then raise exception 'Unexpected identifier initializer in %',f.oid::regprocedure; end if;
   definition:=replace(definition,strict_guard,$guard$if color_plate is not null and length(color_plate)>80 then raise exception 'Color Plate number must be 80 characters or fewer.' using errcode='22023'; end if;$guard$);
   definition:=replace(definition,normalized,$expression$case when (select s.color_plate_number from public.samples s where s.id=target_id) is not distinct from (p_sample->>'color_plate_number') then p_sample->>'color_plate_number' else nullif(upper(btrim(coalesce(p_sample->>'color_plate_number',''))),'') end$expression$);
   execute definition;
   changed:=changed+1;
 end loop;
 if changed<>3 then raise exception 'Expected three current/legacy identifier validators, found %',changed; end if;
end $migration$;
commit;
