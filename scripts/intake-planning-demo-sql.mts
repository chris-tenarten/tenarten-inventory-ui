/** Prints reviewable SQL only. Never connects to a database or seeds hosted data. */
import { intakePlanningDemo, INTAKE_DEMO_MARKER } from '../src/modules/pre-production/planning-demo';
const quote = (value: string | null) => value === null ? 'null' : `'${value.replaceAll("'", "''")}'`;
export function intakeDemoSql(owner: string, cleanup = false) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) throw new Error('An explicitly chosen owner UUID is required.');
  const ids = intakePlanningDemo.map(row => quote(row.id)).join(',');
  const guard = `do $$begin if exists(select 1 from public.bids where id in (${ids}) and (creator_user_id<>${quote(owner)}::uuid or notes is null or notes not like ${quote(INTAKE_DEMO_MARKER + '%')} or project_name not like 'TEST — %' or production_job_id is not null)) then raise exception 'Demo identity conflict or converted demo. No changes made.'; end if; end $$;`;
  if (cleanup) return `begin;\n${guard}\ndelete from public.bid_activity where bid_id in (${ids});\ndelete from public.bids where id in (${ids});\ncommit;\n`;
  return `begin;\n${guard}\n` + intakePlanningDemo.map(row => `with inserted as (
insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id,status,deposit_received_date,contact_name,contact_email,contact_phone,notes,projected_production_start,projected_production_end,projected_window_updated_by,projected_window_updated_at)
values(${[row.id,row.customer,row.project_name,owner,owner,row.status,row.deposit_received_date,row.contact_name,row.contact_email,row.contact_phone,row.notes,row.projected_production_start,row.projected_production_end,row.projected_production_start ? owner : null].map(quote).join(',')},${row.projected_production_start ? 'clock_timestamp()' : 'null'}) on conflict(id) do nothing returning id)
insert into public.bid_activity(bid_id,activity_type,actor_user_id,details) select id,'created',${quote(owner)}::uuid,jsonb_build_object('demonstration',${quote(INTAKE_DEMO_MARKER)}) from inserted;`).join('\n') + '\ncommit;\n';
}
if (process.argv[1]?.endsWith('intake-planning-demo-sql.mts')) {
  const owner = process.argv.find(arg => arg.startsWith('--owner='))?.slice(8);
  if (!owner) throw new Error('Usage: npx tsx scripts/intake-planning-demo-sql.mts --owner=<UUID> [--cleanup]. Outputs SQL only; hosted execution requires separate approval.');
  console.log(intakeDemoSql(owner, process.argv.includes('--cleanup')));
}
