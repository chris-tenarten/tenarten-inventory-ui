// Stateful, synthetic localhost UI fixture. No database, hosted credentials or outbound requests.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fixtureResponse,uuid} from '../retrieval-review-fixture.mjs';
export const REVIEW_API_URL='http://127.0.0.1:55592';
export const REVIEW_ANON_KEY='customer-dialog-local-fixture';
export const REVIEW_EMAIL='customer-review@example.invalid';
export const REVIEW_PASSWORD='Local-review-only!';
const user={id:uuid(900021),aud:'authenticated',role:'authenticated',email:REVIEW_EMAIL,app_metadata:{},user_metadata:{},created_at:'2026-10-15T00:00:00Z'};
const jwt=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:4102444800})).toString('base64url')}.local-only`;
export const reviewSession={access_token:jwt,refresh_token:'synthetic-local-only',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};
export function startMessagingGroupsFixture(){
 const stamp='2026-10-15T00:00:00Z',names=JSON.parse(readFileSync(new URL('../../docs/project-memory/customer-import-approved-2026-10-14.json',import.meta.url),'utf8')).names;
 const company=(name,id)=>({id,name,phone:'',email:'',mailing_address:'',notes:'',default_contact_id:null,archived_at:null,created_at:stamp,updated_at:stamp});
 const tables={production_companies:names.map((name,i)=>company(name,uuid(i+1))),production_contacts:[],jobs:[{id:uuid(1001),name:'Historical review Project',customer:'[Place Services] temporary',job_number:'LOCAL-HISTORICAL',estimate_number:null,work_order_number:null,deposit_date:null,color_plate_number:null,sample_submitted_date:null,approval_date:null,resin_po:null,chip_po:null,owner_name:null,production_status:'not_started',material_status:'unknown',priority:'normal',progress_percent:0,estimated_man_hours:null,estimated_calendar_days:null,contract_value:null,requested_delivery_date:null,planned_start:null,planned_end:null,archived_at:null,remarks:'Synthetic local review only.',created_at:stamp,updated_at:stamp,contact_details:null}]};
 const peers=[{userId:uuid(900022),name:'Draft Review Bob',role:'member'},{userId:uuid(900023),name:'Draft Review Carol',role:'member'}];
 const messages=peers.map((p,i)=>({id:uuid(910000+i),sender_user_id:p.userId,sender_name:p.name,recipient_user_id:user.id,recipient_name:'Review',body:'Synthetic conversation',created_at:stamp,read_at:stamp,attachments:[]}));
 const groups=[];const transfers=new Map();const uploaded=new Set();
 const visible=(m,peer)=>m.group_id?m.group_id===peer:m.sender_user_id===peer||m.recipient_user_id===peer;
 const enrich=m=>({...m,is_reply:!!m.is_reply,reply:m.reply_to_message_id?(()=>{const o=messages.find(x=>x.id===m.reply_to_message_id);return o?{id:o.id,senderName:o.sender_name,body:o.body.slice(0,180),hasAttachments:!!o.attachments.length}:null;})():null});
 messages.push({id:uuid(910100),sender_user_id:peers[0].userId,sender_name:peers[0].name,recipient_user_id:user.id,body:'Reply to a deleted original',created_at:'2026-10-16T00:00:00Z',read_at:stamp,attachments:[],is_reply:true,reply_to_message_id:null});
 for(let i=0;i<85;i++)messages.push({id:uuid(940000+i),sender_user_id:peers[1].userId,sender_name:peers[1].name,recipient_user_id:user.id,body:i===0?'Older original outside latest page':i===84?'Reply pointing beyond latest page':'History fixture '+i,created_at:new Date(Date.UTC(2026,9,20,12,0,i)).toISOString(),read_at:stamp,attachments:[],is_reply:i===84,reply_to_message_id:i===84?uuid(940000):null});
 const calls=[];
 const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  const send=(status,data,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...(origin?{'access-control-allow-origin':origin}:{}),'access-control-allow-headers':'authorization,apikey,content-type,x-client-info,prefer,range,range-unit,tus-resumable,upload-length,upload-metadata,upload-offset,x-upsert,x-signature','access-control-allow-methods':'GET,HEAD,POST,PATCH,OPTIONS','access-control-expose-headers':'content-range,location,upload-offset,tus-resumable',...headers});res.end(JSON.stringify(data));};
  if(!['127.0.0.1:55592','localhost:55592'].includes(req.headers.host)||origin&&origin!=='http://localhost:3000')return send(403,{message:'Local review origin only'});
  if(req.method==='OPTIONS')return send(200,{});
  const url=new URL(req.url,REVIEW_API_URL);
  if(url.pathname.startsWith('/storage/v1/upload/resumable')){
    let bytes=0;for await(const part of req)bytes+=part.length;
    const metadata=Object.fromEntries((req.headers['upload-metadata']||'').split(',').map(p=>{const[k,v]=p.trim().split(' ');return[k,Buffer.from(v||'','base64').toString()];}));
    const path=metadata.objectName||decodeURIComponent(url.pathname.split('/resumable/')[1]||'');
    if(path)uploaded.add(path);
    return send(req.method==='POST'?201:204,null,{'tus-resumable':'1.0.0','upload-offset':String(bytes),'location':REVIEW_API_URL+'/storage/v1/upload/resumable/'+encodeURIComponent(path)});
  }
  let body={};try{let raw='';for await(const part of req)raw+=part;if(raw)body=JSON.parse(raw);}catch{return send(400,{message:'Invalid fixture request'});}
  calls.push({path:url.pathname,method:req.method});
  if(url.pathname==='/__review/state')return send(200,{companies:tables.production_companies,calls,groups,messages});
  if(url.pathname.startsWith('/auth/v1/')){
   if(url.pathname.endsWith('/token'))return send(200,reviewSession);
   return send(200,user);
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1);
   if(name==='get_my_app_access')return send(200,[{user_id:user.id,display_name:'Customer Dialog Review',role:'admin',is_active:true,read_only:false,messaging_write:true,production_blend_manage:false,sample_labels_generate:false}]);
   if(name==='list_my_work_conversations_v12')return send(200,[...peers,...groups].map(p=>{const rows=messages.filter(m=>visible(m,p.userId)),latest=rows.at(-1);return {...p,unread:rows.filter(m=>m.sender_user_id!==user.id&&!m.read_at).length,latest:{id:latest?.id??p.userId,createdAt:latest?.created_at??stamp,body:latest?.body||'No messages yet'}};}));
   if(name==='list_my_work_inbox_recipients')return send(200,peers.map(p=>({user_id:p.userId,display_name:p.name,role:p.role})));
   if(name==='list_my_work_message_page_v12')return send(200,messages.filter(m=>visible(m,body.p_peer)&&(!body.p_ids||body.p_ids.includes(m.id))&&(!body.p_before_time||m.created_at<body.p_before_time||m.created_at===body.p_before_time&&m.id<body.p_before_id)).slice(-40).map(enrich));
   if(name==='mark_my_work_conversation_read_v12'){for(const m of messages)if(body.p_ids.includes(m.id))m.read_at=new Date().toISOString();return send(200,null);}
   if(name==='save_my_work_message_group'){
    let g=groups.find(g=>g.groupId===body.p_id);if(!g){const id=uuid(930000+groups.length);g={userId:id,groupId:id,name:body.p_name,role:'Group',creatorUserId:user.id,memberIds:body.p_members};groups.push(g);}Object.assign(g,{name:body.p_name,memberIds:body.p_members});return send(200,g.groupId);
   }
   if(name==='send_my_work_message_v12'){
    if(body.p_body==='FAIL')return send(503,{message:'Synthetic send failure'});
    const id=uuid(920000+messages.length),g=groups.find(g=>g.groupId===body.p_peer);messages.push({id,sender_user_id:user.id,sender_name:'Review',recipient_user_id:g?null:body.p_peer,group_id:g?.groupId,recipient_name:g?.name||'Peer',body:body.p_body,created_at:new Date().toISOString(),read_at:stamp,attachments:[],is_reply:!!body.p_reply,reply_to_message_id:body.p_reply});return send(200,id);
   }
   if(name==='begin_my_work_attachment_transfer_v12'){transfers.set(body.p_id,body);return send(200,null);}
   if(name==='my_work_attachment_transfer_status'){const t=transfers.get(body.p_id);return send(200,{status:'active',completed:t.p_files.filter(f=>uploaded.has(body.p_id+'/'+f.id+'/file')).map(f=>f.id)});}
   if(name==='finalize_my_work_inbox_message'){
    const t=transfers.get(body.p_message_id),g=groups.find(g=>g.groupId===t.p_recipient);messages.push({id:t.p_id,sender_user_id:user.id,sender_name:'Review',recipient_user_id:g?null:t.p_recipient,group_id:g?.groupId,body:t.p_body,created_at:new Date().toISOString(),read_at:stamp,is_reply:!!t.p_reply,reply_to_message_id:t.p_reply,attachments:t.p_files.map(f=>({id:f.id,message_id:t.p_id,storage_path:t.p_id+'/'+f.id+'/file',original_filename:f.name,content_type:f.contentType,byte_size:f.size,created_at:new Date().toISOString()}))});return send(200,null);
   }
   if(name==='heartbeat_my_work_attachment_transfer')return send(200,null);
   if(name==='edit_my_work_inbox_message'){const m=messages.find(m=>m.id===body.p_message_id);m.body=body.p_body;m.edited_at=new Date().toISOString();return send(200,m.edited_at);}
   if(name==='list_my_unseen_job_update_jobs')return send(200,[],{'content-range':'0-0/0'});
   if(name==='get_my_account_preferences')return send(200,{});
   if(name==='search_production_customers')return send(200,tables.production_companies.filter(c=>c.name.toLowerCase().startsWith((body.p_search||'').trim().toLowerCase())).slice(body.p_offset||0,(body.p_offset||0)+21).map(c=>({company:c,contact:null})));
   if(name==='save_production_customer'){
    const c=body.p_company.id?tables.production_companies.find(c=>c.id===body.p_company.id):company(body.p_company.name,uuid(100+tables.production_companies.length));
    if(!c)return send(404,{message:'Unknown synthetic company'});
    Object.assign(c,body.p_company,{updated_at:new Date().toISOString()});if(!body.p_company.id)tables.production_companies.push(c);
    return send(200,{company:c,contact:null});
   }
   if(/^(get_|list_|search_|suggest_)/.test(name))return send(200,[]);
   if(name==='ensure_my_welcome_notification')return send(200,null);
   return send(403,{message:'Only synthetic customer saves are supported in this UX fixture'});
  }
  if(url.pathname.startsWith('/rest/v1/')&&['GET','HEAD'].includes(req.method)){
   const result=fixtureResponse(url,tables);return send(200,req.headers.accept?.includes('vnd.pgrst.object')?result.rows[0]??null:result.rows,result.headers);
  }
  return send(403,{message:'No database or hosted writes permitted'});
 });
 server.listen(55592,'127.0.0.1');return server;
}
