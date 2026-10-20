// Actual app, synthetic authenticated session, local-only data. Never forwards requests.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {fixtureResponse} from './retrieval-review-fixture.mjs';
import {wave4Fixture,session,userId,otherUserId,uuid,stamp} from './support/wave4-fixture.mjs';
const port=Number(process.env.STARTUP_REVIEW_PORT||3355),origin=`http://localhost:${port}`,root=path.resolve(process.env.STARTUP_REVIEW_ROOT||'out');
let tables=wave4Fixture(),calls=[],control={},receipts=new Map();
const server=createServer(async(req,res)=>{
 const send=(status,value,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});res.end(JSON.stringify(value));};
 try{
  if(req.headers.host!==`localhost:${port}`||(req.headers.origin&&req.headers.origin!==origin))return send(403,{message:'Local origin only'});
  const url=new URL(req.url,origin);let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};
  if(url.pathname==='/__review/'){
   res.writeHead(200,{'content-type':'text/html'});return res.end(`<!doctype html><html><title>Startup candidate review</title><style>body{font:18px system-ui;max-width:700px;margin:10vh auto;padding:24px}button,a{display:block;margin:24px 0;padding:12px}</style><h1>Startup candidate · local fixtures</h1><p>Actual TenOps application and startup components. All data is disposable and stays on this computer.</p><button onclick="sessionStorage.removeItem('tenops.welcomeHeroPlayed:${userId}');location.href='/'">Play a fresh launch</button><a href="/">Continue existing tab (no replay)</a><p>Full sequence: wait through the four-second terrazzo hold. Skip: press Space after the instruction appears, or tap it on touch devices. Reduced motion: enable your system preference, then start a fresh launch.</p></html>`);
  }
  if(url.pathname==='/__review/state')return send(200,{calls,tables,control});
  if(url.pathname==='/__review/control'&&req.method==='POST'){if(body.reset){tables=wave4Fixture();calls=[];receipts=new Map();}control=body;return send(200,true);}
  let actor=userId;try{actor=JSON.parse(Buffer.from((req.headers.authorization||'').split('.')[1],'base64url').toString()).sub;}catch{}
  if(url.pathname.startsWith('/auth/v1/'))return send(200,url.pathname.endsWith('/token')?session(actor):session(actor).user);
  if(url.pathname.startsWith('/rest/v1/')){
   const name=url.pathname.split('/').at(-1),history=name==='manpower_entries'&&!url.searchParams.has('work_date');
   calls.push({name,method:req.method,url:url.pathname+url.search,actor,history});
   if(control.delay&&(!control.delayTable||control.delayTable===name))await new Promise(r=>setTimeout(r,control.delay));
   if(control.fail===name)return send(403,{message:'Controlled local denial',code:'42501'});
   if(url.pathname.includes('/rpc/')){
    if(name==='get_my_app_access')return send(200,[{user_id:actor,display_name:actor===otherUserId?'Review B':'Wave 4 Review',role:'admin',is_active:control.access!=='denied',read_only:false}]);
    if(name==='list_my_unseen_job_update_jobs')return send(200,[],{'content-range':'0-0/0'});
    if(name==='get_my_account_preferences')return send(200,{manpower_recent_labor_expanded:true});
    if(['ensure_my_welcome_notification','set_my_account_preference'].includes(name))return send(200,null);
    if(['receive_pending_receival_quantity','receive_pending_receival'].includes(name)){
     const row=tables.pending_receivals.find(r=>r.id===body.p_receival_id);if(!row)return send(404,{message:'Missing local receival'});
     if(receipts.has(body.p_request_id))return send(200,null);
     const quantity=body.p_quantity??row.quantity_expected-row.quantity_received;if(quantity<=0||quantity>row.quantity_expected-row.quantity_received)return send(400,{message:'Invalid local receipt'});
     const id=uuid(690000+receipts.size),transactionId=uuid(695000+receipts.size);receipts.set(body.p_request_id,{rowId:row.id,quantity,id,transactionId,previous:structuredClone(row)});
     tables.inventory_items.push({...tables.inventory_items[0],id,color:row.material_name,quantity,production_job_id:row.production_job_id,temporary_job_label:row.temporary_job_label,production_job:row.production_job,earmark_notes:row.earmark_notes});
     tables.inventory_transactions.push({...tables.inventory_transactions[0],id:transactionId,item_name:row.material_name,quantity,transaction_type:'intake'});
     row.quantity_received+=quantity;Object.assign(row,{status:row.quantity_received===row.quantity_expected?'received':'partially_received',receipt_inventory_item_id:id,receipt_transaction_id:transactionId,receipt_created_inventory_item:true,received_at:stamp,received_by:body.p_received_by});return send(200,null);
    }
    if(name==='undo_pending_receival_receipt'){
     const entry=[...receipts.values()].reverse().find(r=>r.rowId===body.p_receival_id);if(!entry)return send(400,{message:'Only receipts created in this local review can be undone'});
     Object.assign(tables.pending_receivals.find(r=>r.id===entry.rowId),entry.previous);tables.inventory_items=tables.inventory_items.filter(r=>r.id!==entry.id);tables.inventory_transactions.find(r=>r.id===entry.transactionId).reversed_at=stamp;return send(200,null);
    }
    if(/^(get_|list_|search_|suggest_)/.test(name))return send(200,[]);
    return send(403,{message:'Unsupported disposable operation'});
   }
   if(req.method==='PATCH'&&name==='manpower_entries'){
    const id=url.searchParams.get('id')?.replace(/^eq\./,'');const row=tables.manpower_entries.find(r=>r.id===id);if(!row)return send(404,{});Object.assign(row,body,{updated_at:new Date().toISOString()});return send(200,row);
   }
   if(!['GET','HEAD'].includes(req.method))return send(403,{message:'Unsupported disposable write'});
   const data=actor===otherUserId?{...tables,manpower_entries:[],inventory_items:[],pending_receivals:[],inventory_transactions:[]}:tables;
   const result=fixtureResponse(url,data,500);Object.assign(calls.at(-1),{rows:result.rows.length,bytes:Buffer.byteLength(JSON.stringify(result.rows))});return send(200,req.headers.accept?.includes('vnd.pgrst.object')?result.rows[0]??null:result.rows,result.headers);
  }
  if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/functions/'))return send(403,{message:'No external or unsupported operations'});
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index';const file=[relative,relative+'.html',path.join(relative,'index.html')].map(p=>path.resolve(root,p)).find(p=>p.startsWith(root+path.sep)&&existsSync(p)&&statSync(p).isFile());if(!file)return send(404,{});
  let data=readFileSync(file);const ext=path.extname(file);if(ext==='.html')data=Buffer.from(data.toString().replace('</head>',`<script>if(!localStorage.getItem('sb-localhost-auth-token'))localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(session()))});</script></head>`));
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.txt':'text/plain','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[ext]||'application/octet-stream','cache-control':'no-store','content-security-policy':"connect-src 'self' blob:"});res.end(data);
 }catch(error){send(500,{message:error.message});}
});server.on('upgrade',(_req,socket)=>socket.destroy());server.listen(port,'localhost',()=>console.log(`${origin}/__review/ — actual startup, disposable local data only`));
