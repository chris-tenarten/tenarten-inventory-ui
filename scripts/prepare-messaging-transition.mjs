/** Generates reviewable SQL only; never connects to any database. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function migrationTransaction(source){
 if(createHash('sha256').update(source).digest('hex')!=='eaab161c58a55efeee161d9252ef984acc013bf53b1eb5a8a00635cacc7328d2')throw Error('Frozen application migration hash mismatch');
 const start=source.indexOf('\nbegin;'),end=source.lastIndexOf('\ncommit;');
 if(start<0||end<start)throw Error('Unexpected transaction envelope');
 return `begin;
set local lock_timeout='5s';
lock table public.my_work_messages in share row exclusive mode;
do $$ begin
 if not exists(select 1 from public.messaging_attachment_release where singleton and phase='barrier') then raise exception 'Drain barrier required'; end if;
 if exists(select 1 from public.my_work_messages where delivery_status='draft') then raise exception 'Drain required'; end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='messaging_release_upload_pause' and permissive='RESTRICTIVE') then raise exception 'Storage barrier required'; end if;
end $$;
${source.slice(start+7,end)}
revoke execute on function public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb) from authenticated;
revoke execute on function public.create_my_work_inbox_message_draft(uuid,text,uuid) from authenticated;
update public.messaging_attachment_release set phase='migrated' where singleton;
commit;
`;
}
if(process.argv[1]?.endsWith('/prepare-messaging-transition.mjs')){
 mkdirSync('.tmp-messaging-operations',{recursive:true});
 writeFileSync('.tmp-messaging-operations/apply-migration-paused.sql',migrationTransaction(readFileSync('supabase/migrations/20260925120000_messaging_large_attachments.sql','utf8')));
 console.log('Prepared .tmp-messaging-operations/apply-migration-paused.sql; no database requests.');
}
