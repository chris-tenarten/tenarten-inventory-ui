/** Loopback-only Product review using the existing Messaging interface. All
 * records/Auth/model transports are synthetic. No hosted calls or AI spending. */
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
import {reviewSession,REVIEW_EMAIL} from './support/messaging-groups-review-fixture.mjs';
import {wave2Response} from './support/wave2-fixture.mjs';
const port=55597,origin='http://localhost:3000',f=createContextFixture(reviewSession.user.id),directory='/private/tmp/tenops-tenbot-context-20261031';
const server=createServer(async(req,res)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,range,range-unit','Access-Control-Allow-Methods':'GET,HEAD,POST,OPTIONS','Access-Control-Expose-Headers':'content-range'};
 const send=(status:number,value:unknown,extra={})=>{res.writeHead(status,{...headers,...extra});res.end(JSON.stringify(value));};
 if(!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host??'')||req.headers.origin&&req.headers.origin!==origin)return send(403,{message:'Local review only'});
 if(req.method==='OPTIONS')return send(204,null);
 const url=new URL(req.url!,'http://localhost:'+port);let body:Record<string,unknown>={};
 try{let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>32000)return send(413,{message:'Request too large'});}if(raw)body=JSON.parse(raw);}catch{return send(400,{message:'Invalid request'});}
 if(url.pathname==='/auth/v1/token')return send(200,reviewSession);
 if(req.headers.authorization!=='Bearer '+reviewSession.access_token)return send(401,{message:'Synthetic review session required'});
 if(url.pathname.startsWith('/auth/v1/'))return send(200,reviewSession.user);
 if(url.pathname==='/functions/v1/tenbot'){
  if(!['status','ask','history','clear'].includes(String(body.action)))return send(403,{error:'Only conversation read/review actions are available'});
  try{f.state.now=Date.now();return send(200,await f.run()(body));}catch(e){return send(e&&typeof e==='object'&&'status' in e?Number(e.status):500,{error:e instanceof Error?e.message:'Local review unavailable'});}
 }
 if(url.pathname==='/review/status')return send(200,{mode:'synthetic-offline',liveInference:false,operationalWrites:false,conversationCount:f.rows.size,providerCalls:f.state.providerCalls});
 if(url.pathname.startsWith('/rest/v1/rpc/')){
  const name=url.pathname.split('/').at(-1);
  if(name==='get_my_app_access')return send(200,[{user_id:f.owner,display_name:'Context Review Developer',role:'developer',is_active:true,read_only:false,messaging_write:true}]);
  if(name==='get_my_account_preferences')return send(200,{});
  if(name?.startsWith('list_')||name?.startsWith('get_'))return send(200,[]);
  if(name==='ensure_my_welcome_notification')return send(200,null);
  return send(403,{message:'Operational writes are disabled in this review'});
 }
 if(url.pathname.startsWith('/rest/v1/')&&['GET','HEAD'].includes(req.method??'')){const r=wave2Response(url,{...f.tables,inventory_items:[],pending_receivals:[],account_notifications:[],app_users:[]});return send(200,r.rows,r.headers);}
 return send(403,{message:'Only synthetic review reads are available'});
});
mkdirSync(directory,{recursive:true});server.listen(port,'localhost',()=>{writeFileSync(directory+'/review-server.json',JSON.stringify({pid:process.pid,port,origin,apiUrl:'http://localhost:'+port,account:REVIEW_EMAIL,mode:'synthetic-offline',databaseWrites:false,inferenceCalls:false},null,2)+'\n');console.log('Synthetic conversation review API ready; application review at '+origin+'/my-work. No real AI inference or hosted access.');});
