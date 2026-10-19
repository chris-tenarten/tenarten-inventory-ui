/* eslint-disable @typescript-eslint/ban-ts-comment -- Synthetic local adapter, matching existing review harnesses. */
// @ts-nocheck -- Local synthetic review adapter; no hosted auth/data forwarding.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {wave2Tables,wave2Response,uuid} from './support/wave2-fixture.mjs';
import {emptyProposalEstimateInputs,proposalEstimateDefaultAssumptions} from '../src/modules/proposals/estimate-defaults';
import {calculateProposalEstimate} from '../src/modules/proposals/estimate-calculations';
const port=Number(process.env.WAVE2_PORT||3322),origin=`http://localhost:${port}`,owner=uuid(9999),second=uuid(9998);
let tables=wave2Tables(),failure='',delays={},calls=[],nextId=99000;
const token=id=>Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp:4102444800,role:'authenticated',session_id:id})).toString('base64url')+'.fixture';
const session=id=>({access_token:token(id),refresh_token:'local-fixture',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},email:'wave2@example.invalid'}});
// Execute the actual unchanged renderer with local module resolution only.
mkdirSync('output/wave2',{recursive:true});
let rendererSource=readFileSync('supabase/functions/generate-proposal-pdf/index.ts','utf8').replace("'npm:@supabase/supabase-js@2.101.1'","'@supabase/supabase-js'").replace("'npm:pdf-lib@1.17.1'","'pdf-lib'").replace(/^const allowed = .*$/m,`const allowed = [${JSON.stringify(origin)}];`);
rendererSource=rendererSource.replace(/from '([.][^']+)'/g,(_,file)=>`from '${pathToFileURL(path.resolve('supabase/functions/generate-proposal-pdf',file)).href}'`);
writeFileSync('output/wave2/proposal-renderer.mts','// @ts-nocheck -- local renderer harness\n'+rendererSource);
const {render}=await import(pathToFileURL(path.resolve('output/wave2/proposal-renderer.mts')).href);
function actor(req){try{return JSON.parse(Buffer.from((req.headers.authorization||'').slice(7).split('.')[1],'base64url')).sub;}catch{return owner;}}
const server=createServer(async(req,res)=>{
 const send=(status,value,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});res.end(Buffer.isBuffer(value)||value instanceof Uint8Array?value:JSON.stringify(value));};
 try{
  if(req.headers.host!==`localhost:${port}`||req.headers.origin&&req.headers.origin!==origin)return send(403,{message:'Local origin only'});
  const url=new URL(req.url,origin),name=url.pathname.split('/').at(-1);let raw='';for await(const chunk of req)raw+=chunk;if(raw.length>4*1024*1024)return send(413,{});const body=raw?JSON.parse(raw):{},id=actor(req);
  if(url.pathname==='/__review/state')return send(200,{calls,fail:failure,delays});
  if(url.pathname==='/__review/control'){failure=body.failure??'';delays=body.delays??{};if(body.reset){tables=wave2Tables(body.size??1201);calls=[];}return send(200,true);}
  if(url.pathname.startsWith('/auth/v1/'))return send(200,name==='token'?session(owner):session(id).user);
  if(url.pathname==='/functions/v1/generate-proposal-pdf'&&body.action==='preview')return send(200,await render(body.snapshot),{'content-type':'application/pdf'});
  if(url.pathname.startsWith('/rest/v1/')){
   const start=Date.now();if(delays[name])await new Promise(resolve=>setTimeout(resolve,delays[name]));
   if(failure===name){calls.push({table:name,failed:true,method:req.method});return send(403,{message:'Synthetic retrieval denied',code:'42501'});}
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    if(name==='get_my_app_access')return send(200,[{user_id:id,display_name:id===owner?'Wave 2 Review':'Review B',role:'admin',is_active:true,read_only:false,messaging_write:false,sample_labels_generate:false}]);
    if(name==='get_my_account_preferences')return send(200,{});
    if(name==='has_proposal_access'||name==='has_app_capability')return send(200,true);
    if(name==='ensure_my_welcome_notification')return send(200,null);
    if(name==='create_proposal'){
     const row={...tables.proposals[0],id:uuid(++nextId),estimate_number:'LOCAL-NEW-'+nextId,project_name:'Created local Proposal',status:'draft',issued_at:null,created_at:new Date().toISOString()};tables.proposals.unshift(row);return send(200,row.id);
    }
    if(name==='ensure_proposal_estimate'){
     const inputs=emptyProposalEstimateInputs(),assumptions=proposalEstimateDefaultAssumptions;const row={proposal_id:body.p_proposal_id,inputs,outputs:calculateProposalEstimate(inputs,assumptions),default_assumptions:assumptions,assumption_overrides:{},effective_assumptions:assumptions,defaults_version:1};tables.proposal_estimates.push(row);return send(200,row);
    }
    if(name!=='list_my_unseen_job_update_jobs'){
     if(/^(get_|list_|search_|suggest_)/.test(name))return send(200,[]);
     return send(403,{message:'Unsupported synthetic write; no hosted forwarding'});
    }
   }else if(!['GET','HEAD'].includes(req.method))return send(403,{message:'Unsupported synthetic write'});
   const data=id===second?Object.fromEntries(Object.keys(tables).map(key=>[key,[]])):tables;
   const result=wave2Response(url,data,137),single=req.headers.accept?.includes('vnd.pgrst.object');const payload=single?result.rows[0]??null:result.rows;
   calls.push({table:name,url:url.pathname+url.search,rows:result.rows.length,bytes:Buffer.byteLength(JSON.stringify(payload)),ms:Date.now()-start});return send(single&&!payload?406:200,payload,result.headers);
  }
  if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/functions/')||url.pathname.startsWith('/api/'))return send(403,{message:'No hosted writes'});
  const root=path.resolve(process.env.WAVE2_EXPORT||'out'),relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index';const file=[relative,relative+'.html',path.join(relative,'index.html')].map(file=>path.resolve(root,file)).find(file=>file.startsWith(root+path.sep)&&existsSync(file)&&statSync(file).isFile());if(!file)return send(404,{});
  const ext=path.extname(file);let content=readFileSync(file);
  if(ext==='.html'){
   const selected=url.searchParams.get('reviewAccount')==='B'?second:owner;
   const inject=`<script>localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(session(selected)))});sessionStorage.setItem('tenops.welcomeHeroPlayed:${selected}','true');window.wave2Ready=[];window.addEventListener('tenops:critical-app-ready',()=>window.wave2Ready.push(performance.now()));</script>`;
   content=Buffer.from(content.toString().replace('</head>',inject+'</head>'));
  }
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain','.json':'application/json','.webmanifest':'application/manifest+json'})[ext]||'application/octet-stream','cache-control':'no-store','content-security-policy':"default-src 'self'; connect-src 'self' blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'"});res.end(content);
 }catch(error){send(500,{message:error.message});}
});
server.on('upgrade',(_req,socket)=>socket.destroy());
server.listen(port,'localhost',()=>console.log(`Wave 2 actual app: ${origin} — synthetic local data; no hosted forwarding. Wave 1 on port 3000 unchanged.`));
