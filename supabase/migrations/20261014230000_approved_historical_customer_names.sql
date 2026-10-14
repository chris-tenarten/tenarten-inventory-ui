-- Prepared for local review only. Does NOT import during migration application.
-- Exact Product-approved list, October 14, 2026. Execute hosted only after separate approval.
begin;
create function public.import_approved_historical_customers_20261014()
returns table(customer_name text,status text,company_id uuid)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare approved record; matches integer; existing_id uuid; archived boolean;
begin
 perform public.require_app_capability('manageUsers');
 perform public.require_app_capability('writeBusinessData');
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Run the approved import in a Read Committed transaction.' using errcode='55000';end if;
 -- Serialize this short administrative operation against other imports/company writes.
 -- No global name uniqueness constraint: existing duplicate identities remain untouched.
 lock table public.production_companies in share row exclusive mode;
 for approved in select name from (values
 ('Atlantic Exterior Wall Systems'),
 ('Batson Cooke'),
 ('Buslam'),
 ('Camarata'),
 ('Camarata Masonry Systems'),
 ('Coral Reef'),
 ('DePaoli Mosaic'),
 ('IB SUPPLY'),
 ('IntraState Terrazzo'),
 ('Joseph Cohn & Son'),
 ('LX Granite'),
 ('MTT'),
 ('RNC Concrete Coatings'),
 ('Spectra CF'),
 ('Superior'),
 ('Superior Terrazzo & Finishes'),
 ('T. Yorie Corp.'),
 ('United Enterprises, Inc'),
 ('Williams'),
 ('Williams Tile & Marble')
 ) names(name) order by lower(name) loop
  select count(*),min(c.id::text)::uuid,bool_or(c.archived_at is not null)
   into matches,existing_id,archived from public.production_companies c
   where lower(regexp_replace(c.name,'^[[:space:]]+|[[:space:]]+$','','g'))=lower(approved.name);
  customer_name:=approved.name;company_id:=existing_id;
  if matches>1 then status:='ambiguous_existing';
  elsif matches=1 and archived then status:='archived_excluded';
  elsif matches=1 then status:='already_configured';
  else
   insert into public.production_companies(name) values(approved.name) returning id into company_id;
   status:='inserted';
  end if;
  return next;
 end loop;
end;$$;
revoke all on function public.import_approved_historical_customers_20261014() from public,anon;
grant execute on function public.import_approved_historical_customers_20261014() to authenticated;
commit;
