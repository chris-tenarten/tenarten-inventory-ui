const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET='my-work-inbox-attachments';
export function createHandler({clientFactory,origins=[]}) {
 return async request=>{
  const origin=request.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origin&&origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};
  const reply=(status,code)=>new Response(JSON.stringify({status:code}),{status,headers});
  if(origin&&!origins.includes(origin))return reply(403,'origin_denied');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,'post_required');
  const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return reply(401,'sign_in_required');
  try{
   const raw=await request.text();if(raw.length>1024)return reply(400,'invalid_request');
   const body=JSON.parse(raw);if(!body||Object.keys(body).sort().join(',')!=='confirmation,messageId'||!UUID.test(body.messageId)||body.confirmation!=='PERMANENTLY_DELETE_MESSAGE')return reply(400,'invalid_request');
   const {caller,service}=clientFactory(authorization,(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)}));
   const auth=await caller.auth.getUser();if(auth.error||!auth.data.user)return reply(401,'sign_in_required');
   const actor=auth.data.user.id;
   const profile=await service.from('app_users').select('role,is_active').eq('user_id',actor).maybeSingle();
   if(profile.error)return reply(503,'authorization_unavailable');
   if(profile.data?.role!=='admin'||!profile.data.is_active)return reply(403,'admin_required');
   const already=async()=>{const r=await service.from('my_work_message_deletion_audit').select('deleted_message_id').eq('deleted_message_id',body.messageId).eq('actor_user_id',actor).maybeSingle();return !r.error&&!!r.data;};
   if(await already())return reply(200,'already_deleted');
   // Only lifecycle fields, never message bodies, filenames, bytes or signed URLs.
   const state=await service.from('my_work_messages').select('delivery_status,sender_kind').eq('id',body.messageId).maybeSingle();
   if(state.error)return reply(503,'state_unavailable');
   if(!state.data)return reply(404,'message_unavailable');
   if(state.data.delivery_status!=='ready'||state.data.sender_kind==='system')return reply(409,'finalized_user_message_required');
   const prepared=await caller.rpc('prepare_admin_delete_my_work_message',{p_message_id:body.messageId});
   if(prepared.error)return reply(403,'prepare_denied');
   const paths=(prepared.data??[]).map(row=>row.storage_path);
   if(new Set(paths).size!==paths.length||paths.some(path=>typeof path!=='string'||!path.startsWith(body.messageId+'/')||path.split('/').length!==3||!UUID.test(path.split('/')[1])||!path.split('/')[2]||path.split('/')[2]==='..'))return reply(409,'manifest_mismatch');
   // Paths come only from the guarded RPC. No caller bucket/path/attachment selection.
   for(let i=0;i<paths.length;i+=100){const removed=await service.storage.from(BUCKET).remove(paths.slice(i,i+100));if(removed.error)return reply(503,'storage_cleanup_failed');}
   // Authoritative absence check + locked metadata/audit transaction. Empty Storage
   // responses are NEVER sufficient evidence of success. Already absent objects are
   // recoverable; a surviving object makes this RPC reject and metadata stays intact.
   const done=await caller.rpc('admin_permanently_delete_my_work_message',{p_message_id:body.messageId,p_confirmation:body.confirmation});
   if(done.error){if(await already())return reply(200,'already_deleted');return reply(409,'deletion_not_finalized');}
   return reply(200,'deleted');
  }catch{return reply(503,'deletion_incomplete');}
 };
}
