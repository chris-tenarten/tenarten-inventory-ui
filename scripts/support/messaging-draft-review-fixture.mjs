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
export function startMessagingDraftFixture(){
 const stamp='2026-10-15T00:00:00Z',names=JSON.parse(readFileSync(new URL('../../docs/project-memory/customer-import-approved-2026-10-14.json',import.meta.url),'utf8')).names;
 const company=(name,id)=>({id,name,phone:'',email:'',mailing_address:'',notes:'',default_contact_id:null,archived_at:null,created_at:stamp,updated_at:stamp});
 const tables={production_companies:names.map((name,i)=>company(name,uuid(i+1))),production_contacts:[],jobs:[{id:uuid(1001),name:'Historical review Project',customer:'[Place Services] temporary',job_number:'LOCAL-HISTORICAL',estimate_number:null,work_order_number:null,deposit_date:null,color_plate_number:null,sample_submitted_date:null,approval_date:null,resin_po:null,chip_po:null,owner_name:null,production_status:'not_started',material_status:'unknown',priority:'normal',progress_percent:0,estimated_man_hours:null,estimated_calendar_days:null,contract_value:null,requested_delivery_date:null,planned_start:null,planned_end:null,archived_at:null,remarks:'Synthetic local review only.',created_at:stamp,updated_at:stamp,contact_details:null}]};
 const peers=[{userId:uuid(900022),name:'Draft Review Bob',role:'member'},{userId:uuid(900023),name:'Draft Review Carol',role:'member'}];
 const messages=peers.map((p,i)=>({id:uuid(910000+i),sender_user_id:p.userId,sender_name:p.name,recipient_user_id:user.id,recipient_name:'Review',body:'Synthetic conversation',created_at:stamp,read_at:stamp,attachments:[]}));
 const calls=[];
 const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  const send=(status,data,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...(origin?{'access-control-allow-origin':origin}:{}),'access-control-allow-headers':'authorization,apikey,content-type,x-client-info,prefer,range,range-unit','access-control-allow-methods':'GET,HEAD,POST,OPTIONS','access-control-expose-headers':'content-range',...headers});res.end(JSON.stringify(data));};
  if(!['127.0.0.1:55592','localhost:55592'].includes(req.headers.host)||origin&&origin!=='http://localhost:3000')return send(403,{message:'Local review origin only'});
  if(req.method==='OPTIONS')return send(200,{});
  const url=new URL(req.url,REVIEW_API_URL);let body={};try{let raw='';for await(const part of req)raw+=part;if(raw)body=JSON.parse(raw);}catch{return send(400,{message:'Invalid fixture request'});}
  calls.push({path:url.pathname,method:req.method});
  if(url.pathname==='/__review/state')return send(200,{companies:tables.production_companies,calls});
  if(url.pathname.startsWith('/auth/v1/')){
   if(url.pathname.endsWith('/token'))return send(200,reviewSession);
   return send(200,user);
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1);
   if(name==='get_my_app_access')return send(200,[{user_id:user.id,display_name:'Customer Dialog Review',role:'admin',is_active:true,read_only:false,messaging_write:true,production_blend_manage:false,sample_labels_generate:false}]);
   if(name==='list_my_work_conversations_v11')return send(200,peers.map(p=>({...p,unread:0,latest:{id:messages[0].id,createdAt:stamp,body:'Synthetic conversation'}})));
   if(name==='list_my_work_inbox_recipients')return send(200,peers.map(p=>({user_id:p.userId,display_name:p.name,role:p.role})));
   if(name==='list_my_work_message_page_v11')return send(200,messages.filter(m=>(m.sender_user_id===body.p_peer||m.recipient_user_id===body.p_peer)&&(!body.p_ids||body.p_ids.includes(m.id))));
   if(name==='mark_my_work_inbox_conversation_read')return send(200,null);
   if(name==='send_my_work_inbox_message'){
    if(body.p_body==='FAIL')return send(503,{message:'Synthetic send failure'});
    await new Promise(resolve=>setTimeout(resolve,700));
    const id=uuid(920000+messages.length);messages.push({id,sender_user_id:user.id,sender_name:'Review',recipient_user_id:body.p_recipient_user_id,recipient_name:'Peer',body:body.p_body,created_at:new Date().toISOString(),read_at:stamp,attachments:[]});return send(200,id);
   }
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
