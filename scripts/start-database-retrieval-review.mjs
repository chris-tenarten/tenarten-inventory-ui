// Actual exported TenOps, with strictly local disposable read-only fixture APIs.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeRetrievalFixture,fixtureResponse,uuid} from './retrieval-review-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.RETRIEVAL_REVIEW_PORT||3000),origin=`http://localhost:${port}`,tables=makeRetrievalFixture(),calls=[],observations=[];
const userA=uuid(900001),userB=uuid(900002);
function actor(id){const user={id,aud:'authenticated',role:'authenticated',email:'local-review@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-10-14T00:00:00Z'};const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:4102444800})).toString('base64url')}.local-review`;return{access_token:token,refresh_token:'local-only',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};}
const json=(res,status,value,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});res.end(JSON.stringify(value));};
function save(){mkdirSync(path.join(root,'docs/project-memory/evidence'),{recursive:true});writeFileSync(process.env.RETRIEVAL_REVIEW_EVIDENCE||'/private/tmp/tenops-retrieval-browser-live.json',JSON.stringify({note:'Local actual exported app. Synthetic read-only users and data. No hosted connections. Timings from one browser session, not percentiles.',calls,observations},null,2));}
const server=createServer(async(req,res)=>{
 try{
  if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)||(req.headers.origin&&req.headers.origin!==origin))return json(res,403,{message:'Local origin required'});
  const url=new URL(req.url,origin),referrer=new URL(req.headers.referer||origin),account=referrer.searchParams.get('reviewAccount')==='B'?userB:userA;
  const session=actor(account);
  if(url.pathname==='/__review/evidence')return json(res,200,{calls,observations});
  if(url.pathname==='/__review/observe'&&req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;observations.push(JSON.parse(raw));save();return json(res,200,true);}
  if(url.pathname.startsWith('/auth/v1/'))return json(res,200,url.pathname.endsWith('/token')?session:session.user);
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1);calls.push({table:name,account,method:req.method,time:Date.now()});save();
   if(name==='get_my_app_access')return json(res,200,[{user_id:account,display_name:account===userB?'Review B':'Review A',role:'admin',is_active:true,read_only:true,messaging_write:false,production_blend_manage:false,sample_labels_generate:true}]);
   if(name==='get_my_account_preferences')return json(res,200,{manpower_recent_labor_expanded:true});
   if(name==='has_app_capability'||name==='has_proposal_access')return json(res,200,true);
   if(/^(get_|list_|search_|suggest_)/.test(name))return json(res,200,[]);
   return json(res,403,{message:'Local review is read-only'});
  }
  if(url.pathname.startsWith('/rest/v1/')){
   if(!['GET','HEAD'].includes(req.method))return json(res,403,{message:'Local review is read-only'});
   const data=account===userB?{...tables,manpower_entries:[],manpower_workers:tables.manpower_workers.map(w=>({...w,display_name:'Review B worker'}))}:tables;
   const result=fixtureResponse(url,data,500),start=Date.now();
   if(referrer.searchParams.get('reviewFailMaterial')==='1'&&result.table==='material_usage_reports')return json(res,403,{message:'Synthetic material read denied',code:'42501'});
   const historical=result.table==='manpower_entries'&&!url.searchParams.has('work_date')&&!url.searchParams.has('job_id');
   const lag=historical&&Number(url.searchParams.get('offset')||0)===0?Number(referrer.searchParams.get('reviewHistoryDelay')||0):20;
   await new Promise(resolve=>setTimeout(resolve,lag));
   calls.push({table:result.table,account,url:url.pathname+url.search,rows:result.rows.length,bytes:Buffer.byteLength(JSON.stringify(result.rows)),started:start,done:Date.now()});save();
   res.writeHead(200,{'cache-control':'no-store',...result.headers});return res.end(req.method==='HEAD'?'':JSON.stringify(result.rows));
  }
  if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/functions/'))return json(res,403,{message:'Local review is read-only'});
  const app=path.join(root,'out'),relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index';
  const file=[relative,relative+'.html',path.join(relative,'index.html')].map(p=>path.resolve(app,p)).find(p=>p.startsWith(app+path.sep)&&existsSync(p)&&statSync(p).isFile());if(!file)return json(res,404,{message:'Not found'});
  let content=readFileSync(file);const ext=path.extname(file);
  if(ext==='.html'){
   const id=url.searchParams.get('reviewAccount')==='B'?userB:userA;
   const inject=`<script>localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(actor(id)))});sessionStorage.setItem('tenops.welcomeHeroPlayed:${id}','true');(function(){let previous='';const report=()=>{const a=document.querySelector('[data-testid="analytics-total"]');const jobs=document.body.innerText.includes('Retrieval Job 0');const historyLoading=document.body.innerText.includes('Loading manpower entries');const value=JSON.stringify({analytics:a?.textContent||null,jobs,historyLoading});if(value!==previous){previous=value;fetch('/__review/observe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:location.pathname+location.search,ms:performance.now(),...JSON.parse(value)})});}};new MutationObserver(report).observe(document.documentElement,{childList:true,subtree:true,characterData:true});})();</script>`;
   content=Buffer.from(content.toString().replace('</head>',inject+'</head>'));
  }
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.json':'application/json','.txt':'text/plain'})[ext]||'application/octet-stream','cache-control':'no-store','content-security-policy':`connect-src 'self' ws://localhost:${port}`});res.end(req.method==='HEAD'?undefined:content);
 }catch(error){json(res,400,{message:error.message});}
});server.on('upgrade',(_req,socket)=>socket.destroy());
server.listen(port,'localhost',()=>console.log(`${origin}/manpower-reporting?reviewHistoryDelay=15000 — actual app, synthetic read-only local data`));
