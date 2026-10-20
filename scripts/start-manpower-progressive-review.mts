/* eslint-disable @typescript-eslint/ban-ts-comment -- Local review adapter reuses heterogeneous fixtures/renderers. */
// @ts-nocheck -- No hosted forwarding in synthetic mode. Optional hosted reads use the existing fail-closed guard.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {wave2Tables,uuid,stamp} from './support/wave2-fixture.mjs';
import {session as wave4Session} from './support/wave4-fixture.mjs';
import {progressiveManpowerFixture as wave4Fixture,progressiveResponse as wave2Response} from './support/manpower-progressive-fixture.mjs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index.ts';
import {emptyProposalEstimateInputs,proposalEstimateDefaultAssumptions} from '../src/modules/proposals/estimate-defaults';
import {calculateProposalEstimate} from '../src/modules/proposals/estimate-calculations';
import {PREFIX,CSP,planRequest,forwardHeaders} from './support/read-only-review-guard.mjs';
const port=Number(process.env.PERFORMANCE_REVIEW_PORT||3355),origin=`http://localhost:${port}`,hosted=process.argv.includes('--hosted-read-only'),owner=uuid(900021);
const session=(id=owner,version=1)=>wave4Session(id,version);
const source=hosted?Object.fromEntries(readFileSync('/Users/chrisngo/source/repos/tenarten-inventory-ui/.env.local','utf8').split('\n').filter(l=>/^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=/.test(l)).map(l=>{const at=l.indexOf('=');return[l.slice(0,at),l.slice(at+1).trim().replace(/^(["'])(.*)\1$/,'$2')];})):{};
if(hosted&&(!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(source.NEXT_PUBLIC_SUPABASE_URL)||!source.NEXT_PUBLIC_SUPABASE_ANON_KEY))throw Error('Existing hosted public configuration required.');
let tables,samples,messages,notices,calls=[],control={},next=980000;
const peers=[{user_id:uuid(900022),display_name:'Wave Bob',role:'member'},{user_id:uuid(900023),display_name:'Wave Carol',role:'member'}];
const snapshot=structuredClone(blendFixtures[4].snapshot);Object.assign(snapshot,{id:uuid(710001),sampleName:'Integrated Sample',colorPlateNumber:'T26-901-A'});
const snake=k=>k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),camel=k=>k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const toRow=s=>({...Object.fromEntries(Object.entries(s).map(([k,v])=>[snake(k),v])),formulation_state:s.formulation,blend_rows:s.blendRows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[snake(k),v]))),working_versions:[],issued_documents:[]});
const working=row=>({...Object.fromEntries(Object.entries(row).map(([k,v])=>[camel(k),v])),formulation:row.formulation_state,blendRows:row.blend_rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[camel(k),v])))});
function reset(){
 const w2=wave2Tables(),w4=wave4Fixture();tables={...w2,...w4,...Object.fromEntries(['proposals','proposal_lines','proposal_estimates','purchase_orders','purchase_order_lines','purchase_order_issuances','vendor_catalog','vendor_catalog_v2','vendors','vendor_contacts','job_updates','job_attachments','material_usage_reports','material_usage_lines','bid_proposal_relationships'].map(k=>[k,w2[k]])),jobs:[...w2.jobs,...w4.jobs]};
 snapshot.jobId=w4.jobs[0].id;snapshot.jobNumber=w4.jobs[0].job_number;samples=[toRow(snapshot)];
 const p=snapshot.formulation.profile;tables.sample_operational_profiles=[{id:uuid(710030),revision:1,name:'Local captured Resin System',sort_order:1,is_active:true,chip_density:Number(p.defaultChipDensityLbCft),dry_pool_rate:Number(p.dryPoolOzPerCft),filler_rate:Number(p.defaultFillerOzPerCft),resin_rate:Number(p.resinFlOzPerCft),resin_parts:Number(p.resinParts),hardener_parts:Number(p.hardenerParts),batch_contract:p.batchContract,batch_chip_target_lb:Number(p.batchChipTargetLb),batch_reference_thickness_in:Number(p.batchReferenceThicknessIn),description:'Existing synthetic captured formulation'}];
 messages=peers.map((p,i)=>({id:uuid(910000+i),sender_user_id:p.user_id,sender_name:p.display_name,recipient_user_id:owner,recipient_name:'Integrated Review',body:'Synthetic integrated conversation '+i,created_at:stamp,read_at:null,attachments:[]}));
 notices=[{id:uuid(930001),user_id:owner,notification_type:'fixture',title:'Integrated review notification',body:'Synthetic notification only',metadata:{},read_at:null,created_at:stamp}];calls=[];control={};
}reset();
mkdirSync('output/integration',{recursive:true});
let renderer=readFileSync('supabase/functions/generate-proposal-pdf/index.ts','utf8').replace("'npm:@supabase/supabase-js@2.101.1'","'@supabase/supabase-js'").replace("'npm:pdf-lib@1.17.1'","'pdf-lib'").replace(/^const allowed = .*$/m,`const allowed = [${JSON.stringify(origin)}];`);
renderer=renderer.replace(/from '([.][^']+)'/g,(_,file)=>`from '${pathToFileURL(path.resolve('supabase/functions/generate-proposal-pdf',file)).href}'`);
writeFileSync('output/integration/proposal-renderer.mts','// @ts-nocheck -- existing local renderer adapter\n'+renderer);const {render:renderProposal}=await import(pathToFileURL(path.resolve('output/integration/proposal-renderer.mts')).href);
const security={'cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':hosted?CSP.replaceAll('ws://localhost:3000',`ws://localhost:${port}`):"default-src 'self'; connect-src 'self' blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'"};
const server=createServer(async(req,res)=>{
 const send=(status,value,headers={})=>{res.writeHead(status,{...security,'content-type':'application/json',...headers});res.end(Buffer.isBuffer(value)||value instanceof Uint8Array?value:JSON.stringify(value));};
 try{
  if(req.headers.host!==`localhost:${port}`||(req.headers.origin&&req.headers.origin!==origin))return send(403,{message:'Local origin only'});
  const url=new URL(req.url,origin),name=url.pathname.split('/').at(-1);let raw='';for await(const part of req){raw+=part;if(raw.length>4*1024*1024)return send(413,{});}const body=raw?JSON.parse(raw):{};
  if(url.pathname==='/__review/state')return send(200,{mode:hosted?'hosted-read-only':'synthetic',calls,control,hostedBusinessWrites:0});
  if(!hosted&&url.pathname==='/__review/control'){if(body.reset)reset();control=body;return send(200,true);}
  if(/^\/(auth|rest|functions|storage|realtime)\//.test(url.pathname)){
   const call={name,method:req.method,path:url.pathname+url.search,started:Date.now()};calls.push(call);
   if(hosted){
    const plan=planRequest(PREFIX+url.pathname+url.search,req.method,body);if(!plan){call.blocked=true;return send(403,{message:'READ-ONLY REVIEW: operation disabled',code:'LOCAL_READ_ONLY_REVIEW'});}
    const headers=forwardHeaders(req.headers,source.NEXT_PUBLIC_SUPABASE_ANON_KEY);if(plan.body)headers['content-type']='application/json';
    const upstream=await fetch(new URL(plan.path,source.NEXT_PUBLIC_SUPABASE_URL),{method:plan.method,headers,body:plan.body?JSON.stringify(plan.body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
    call.forwardMethod=plan.method;call.kind=plan.kind;call.status=upstream.status;const data=Buffer.from(await upstream.arrayBuffer());call.bytes=data.length;const h={};for(const k of ['content-type','content-range'])if(upstream.headers.has(k))h[k]=upstream.headers.get(k);return send(upstream.status,data,h);
   }
   if(control.historyDelay&&name==='manpower_entries'&&url.searchParams.has('reporting_group_id'))await new Promise(r=>setTimeout(r,control.historyDelay));
   if(control.delays?.[name])await new Promise(r=>setTimeout(r,control.delays[name]));
   if(control.failure===name||(control.failHistory&&name==='manpower_entries'&&url.searchParams.has('reporting_group_id'))){call.denied=true;return send(403,{message:'Synthetic integrated denial',code:'42501'});}
   let actor=owner;try{actor=JSON.parse(Buffer.from((req.headers.authorization||'').split('.')[1],'base64url')).sub;}catch{}
   if(url.pathname.startsWith('/auth/'))return send(200,name==='token'?session(actor):session(actor).user);
   const row=samples.find(r=>r.id===(body.sampleId||body.p_sample_id||body.p_sample?.id))??samples[0];
   if(url.pathname==='/functions/v1/generate-sample-pdf'&&['working','preview'].includes(body.action))return send(200,await renderSampleWorkOrder(body.snapshot??working(row)),{'content-type':'application/pdf'});
   if(url.pathname==='/functions/v1/generate-proposal-pdf'&&body.action==='preview')return send(200,await renderProposal(body.snapshot),{'content-type':'application/pdf'});
   if(!url.pathname.startsWith('/rest/'))return send(403,{message:'Unsupported disposable operation'});
   if(url.pathname.includes('/rpc/')){
    if(name==='get_my_app_access')return send(200,[{user_id:actor,display_name:actor===owner?'Integrated Review':'Review B',role:'admin',is_active:control.access!=='denied',read_only:control.readOnly===true,messaging_write:true,production_blend_manage:true}]);
    if(name==='get_my_account_preferences')return send(200,{manpower_recent_labor_expanded:true});
    if(name==='has_proposal_access'||name==='has_app_capability')return send(200,true);
    if(name==='ensure_my_welcome_notification')return send(200,null);
    if(name==='list_my_work_inbox_recipients')return send(200,peers);
    if(name==='list_my_work_conversations_v11')return send(200,actor===owner?peers.map(p=>{const rows=messages.filter(m=>m.sender_user_id===p.user_id||m.recipient_user_id===p.user_id),last=rows.at(-1);return{userId:p.user_id,name:p.display_name,role:p.role,unread:rows.filter(m=>m.recipient_user_id===owner&&!m.read_at).length,latest:last?{id:last.id,body:last.body,createdAt:last.created_at}:null};}):[]);
    if(name==='list_my_work_message_page_v11')return send(200,actor===owner?messages.filter(m=>(m.sender_user_id===body.p_peer||m.recipient_user_id===body.p_peer)&&(!body.p_ids||body.p_ids.includes(m.id))):[]);
    if(name==='mark_my_work_inbox_conversation_read'){for(const m of messages)if(m.sender_user_id===body.p_other_user_id)m.read_at=stamp;return send(200,null);}
    if(name==='send_my_work_inbox_message'){const id=uuid(++next);messages.push({id,sender_user_id:actor,sender_name:'Integrated Review',recipient_user_id:body.p_recipient_user_id,recipient_name:'Peer',body:body.p_body,created_at:new Date().toISOString(),read_at:null,attachments:[]});return send(200,id);}
    if(name==='list_my_account_notification_history')return send(200,actor===owner?notices:[]);
    if(name==='mark_all_my_account_notifications_read'||name==='mark_my_account_notification_read'){for(const n of notices)if(!body.p_notification_id||n.id===body.p_notification_id)n.read_at=stamp;return send(200,null);}
    if(name==='list_samples')return send(200,actor===owner?samples.map(sample=>({sample})):[]);
    if(name==='get_sample_formulation_default')return send(200,{});
    if(name==='suggest_sample_color_plate_number')return send(200,`T26-${901+samples.length}-A`);
    if(name==='save_sample_draft'){Object.assign(row,body.p_sample,{blend_rows:body.p_rows});return send(200,null);}
    if(name==='create_sample_with_formulation'){const created={...structuredClone(row),...body.p_sample,id:uuid(++next),blend_rows:body.p_rows,working_versions:[],issued_documents:[]};samples.push(created);return send(200,{id:created.id,color_plate_number:created.color_plate_number});}
    if(name==='record_my_sample_recent_values')return send(200,null);
    if(name==='create_proposal'){const p={...tables.proposals[0],id:uuid(++next),status:'draft',project_name:'Created local Proposal',issued_at:null};tables.proposals.unshift(p);return send(200,p.id);}
    if(name==='ensure_proposal_estimate'){const inputs=emptyProposalEstimateInputs(),assumptions=proposalEstimateDefaultAssumptions;const estimate={proposal_id:body.p_proposal_id,inputs,outputs:calculateProposalEstimate(inputs,assumptions),default_assumptions:assumptions,assumption_overrides:{},effective_assumptions:assumptions,defaults_version:1};tables.proposal_estimates.push(estimate);return send(200,estimate);}
    if(name==='list_my_unseen_job_update_jobs'){const r=wave2Response(url,{list_my_unseen_job_update_jobs:tables.jobs.map(j=>({job_id:j.id,unseen_count:1}))},137);return send(200,r.rows,r.headers);}
    if(/^(get_|list_|search_|suggest_)/.test(name))return send(200,[]);
    return send(403,{message:'Unsupported disposable write'});
   }
   // Disposable fixture editing only; hosted mode exits through the read-only guard above.
   if(actor===owner&&req.method==='POST'&&name==='manpower_reporting_groups'){
    const row={...body,id:uuid(++next),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};tables.manpower_reporting_groups.push(row);return send(200,row);
   }
   if(actor===owner&&req.method==='POST'&&name==='manpower_entries'){
    const row={...body,id:uuid(++next),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),worker:tables.manpower_workers.find(r=>r.id===body.worker_id),task:tables.manpower_tasks.find(r=>r.id===body.task_id),reporting_group:tables.manpower_reporting_groups.find(r=>r.id===body.reporting_group_id),job:tables.jobs.find(r=>r.id===body.job_id)??null,rework_cycle:null};tables.manpower_entries.push(row);return send(200,row);
   }
   if(req.method==='PATCH'&&name==='manpower_entries'&&actor===owner){
    const id=url.searchParams.get('id'),ids=id?.startsWith('in.(')?id.slice(4,-1).split(','):[id?.replace(/^eq\./,'')];
    const rows=tables.manpower_entries.filter(row=>ids.includes(row.id));
    for(const row of rows){Object.assign(row,body,{updated_at:new Date().toISOString()});if('job_id' in body)row.job=tables.jobs.find(job=>job.id===body.job_id)??null;}
    return send(200,req.headers.accept?.includes('vnd.pgrst.object')?rows[0]:rows,{'content-range':`0-${rows.length-1}/${rows.length}`});
   }
   if(!['GET','HEAD'].includes(req.method))return send(403,{message:'Unsupported disposable write'});
   const data=actor===owner?{...tables,my_work_messages:messages}:Object.fromEntries(Object.keys(tables).map(k=>[k,[]]));
   if(control.emptyManpower){data.manpower_entries=[];data.manpower_reporting_groups=[];}
   const result=wave2Response(url,data,137),single=req.headers.accept?.includes('vnd.pgrst.object'),payload=single?result.rows[0]??null:result.rows;
   call.rows=req.method==='HEAD'?0:result.rows.length;call.bytes=req.method==='HEAD'?0:Buffer.byteLength(JSON.stringify(payload));call.done=Date.now();return send(single&&!payload?406:200,payload,result.headers);
  }
  if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/api/')||url.pathname.startsWith('/__'))return send(403,{message:'No unsupported operations'});
  const root=path.resolve(process.env.PERFORMANCE_REVIEW_EXPORT_ROOT||'out'),relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index';const file=[relative,relative+'.html',path.join(relative,'index.html')].map(p=>path.resolve(root,p)).find(p=>p.startsWith(root+path.sep)&&existsSync(p)&&statSync(p).isFile());if(!file)return send(404,{});
  let content=readFileSync(file);const ext=path.extname(file);if(ext==='.html'){
   const inject=hosted?'<style>body::before{content:"HOSTED READ-ONLY REVIEW · Unsupported reads and all business writes are blocked";position:fixed;bottom:0;right:0;z-index:9999;background:#fef9c3;padding:6px;font:11px system-ui;pointer-events:none}</style>':`<script>if(!localStorage.getItem('sb-localhost-auth-token'))localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(session()))});sessionStorage.setItem('tenops.welcomeHeroPlayed:${owner}','true');</script>`;
   content=Buffer.from(content.toString().replace('</head>',inject+'</head>'));
  }
  res.writeHead(200,{...security,'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.txt':'text/plain','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[ext]||'application/octet-stream'});res.end(content);
 }catch(error){send(502,{message:hosted?'Read-only review unavailable; no fallback':error.message});}
});server.on('upgrade',(_req,socket)=>socket.destroy());server.listen(port,'localhost',()=>console.log(`${origin} — ${hosted?'guarded hosted reads; normal sign-in; unsupported scenarios blocked':'one integrated application, synthetic data only'}`));
