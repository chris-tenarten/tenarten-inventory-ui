/* eslint-disable @typescript-eslint/ban-ts-comment -- Local review adapter reuses heterogeneous fixtures/renderers. */
// @ts-nocheck -- No hosted forwarding in synthetic mode. Optional hosted reads use the existing fail-closed guard.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {wave2Tables,wave2Response,uuid,stamp} from './support/wave2-fixture.mjs';
import {wave4Fixture,session as wave4Session} from './support/wave4-fixture.mjs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index.ts';
import {emptyProposalEstimateInputs,proposalEstimateDefaultAssumptions} from '../src/modules/proposals/estimate-defaults';
import {calculateProposalEstimate} from '../src/modules/proposals/estimate-calculations';
import {PREFIX,CSP,planRequest,forwardHeaders} from './support/read-only-review-guard.mjs';
const port=Number(process.env.MOBILE_REVIEW_PORT||3020),origin=`http://localhost:${port}`,hosted=false,owner=uuid(900021);
const session=(id=owner,version=1)=>wave4Session(id,version);
const source={};
let tables,samples,messages,notices,calls=[],control={},next=980000;
const peers=[{user_id:uuid(900022),display_name:'Wave Bob',role:'member'},{user_id:uuid(900023),display_name:'Wave Carol',role:'member'}];
const snapshot=structuredClone(blendFixtures[4].snapshot);Object.assign(snapshot,{id:uuid(710001),sampleName:'Integrated Sample',colorPlateNumber:'T26-901-A'});
const snake=k=>k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),camel=k=>k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const toRow=s=>({...Object.fromEntries(Object.entries(s).map(([k,v])=>[snake(k),v])),formulation_state:s.formulation,blend_rows:s.blendRows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[snake(k),v]))),working_versions:[],issued_documents:[]});
const working=row=>({...Object.fromEntries(Object.entries(row).map(([k,v])=>[camel(k),v])),formulation:row.formulation_state,blendRows:row.blend_rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[camel(k),v])))});
function reset(){
 const w2=wave2Tables(),w4=wave4Fixture();tables={...w2,...w4,...Object.fromEntries(['proposals','proposal_lines','proposal_estimates','purchase_orders','purchase_order_lines','purchase_order_issuances','vendor_catalog','vendor_catalog_v2','vendors','vendor_contacts','job_updates','job_attachments','material_usage_reports','material_usage_lines','bid_proposal_relationships'].map(k=>[k,w2[k]])),jobs:[...w2.jobs,...w4.jobs]};
 tables.jobs.forEach((job,i)=>Object.assign(job,{contract_value:null,estimated_calendar_days:null,customer:'Synthetic Mobile Review',customer_company_id:null,customer_contact_id:null,customer_contact_snapshot:null,planned_start:i<12?'2026-10-'+String(14+i).padStart(2,'0'):null,planned_end:i<12?'2026-11-'+String(5+i).padStart(2,'0'):null,production_status:['not_started','on_deck','in_production','on_hold'][i%4],material_status:'ordered',progress_percent:0,estimated_man_hours:10}));
 tables.bids=Array.from({length:8},(_,i)=>({id:uuid(750000+i),project_name:'Mobile Bid Project '+i,customer:'Synthetic Bid Customer',creator_user_id:owner,creator_name:'Review',owner_user_id:owner,owner_name:'Review',status:i===7?'lost':'active',deposit_received_date:null,contact_name:null,contact_email:null,contact_phone:null,notes:'',created_at:stamp,updated_at:stamp,projected_production_start:'2026-10-'+String(18+i).padStart(2,'0'),projected_production_end:'2026-11-10',production_job_id:null,converted_at:null,converted_by_user_id:null}));
 tables.planning_phases=[{id:uuid(760001),job_id:tables.jobs[0].id,title:'Preparation',timeline_behavior:'overlay',timeline_color:'industrial_teal',start_date:'2026-10-17',end_date:'2026-10-21',created_at:stamp,updated_at:stamp},{id:uuid(760002),job_id:tables.jobs[0].id,title:'Awaiting approval',timeline_behavior:'pause',start_date:'2026-10-22',end_date:'2026-10-24',created_at:stamp,updated_at:stamp}];
 tables.planning_phases=tables.planning_phases.map(phase=>({description:'Synthetic review phase',owner:null,category:'internal',status:'planned',include_in_planning_progress:false,timeline_color:null,library_phase_id:null,blocked_by_phase_id:null,created_by:null,...phase}));
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
   if(control.delays?.[name])await new Promise(r=>setTimeout(r,control.delays[name]));
   if(control.failure===name){call.denied=true;return send(403,{message:'Synthetic integrated denial',code:'42501'});}
   let actor=owner;try{actor=JSON.parse(Buffer.from((req.headers.authorization||'').split('.')[1],'base64url')).sub;}catch{}
   if(url.pathname.startsWith('/auth/'))return send(200,name==='token'?session(actor):session(actor).user);
   const row=samples.find(r=>r.id===(body.sampleId||body.p_sample_id||body.p_sample?.id))??samples[0];
   if(url.pathname==='/functions/v1/generate-sample-pdf'&&['working','preview'].includes(body.action))return send(200,await renderSampleWorkOrder(body.snapshot??working(row)),{'content-type':'application/pdf'});
   if(url.pathname==='/functions/v1/generate-proposal-pdf'&&body.action==='preview')return send(200,await renderProposal(body.snapshot),{'content-type':'application/pdf'});
   if(!url.pathname.startsWith('/rest/'))return send(403,{message:'Unsupported disposable operation'});
   if(url.pathname.includes('/rpc/')){
    if(name==='get_my_app_access')return send(200,[{user_id:actor,display_name:actor===owner?'Integrated Review':'Review B',role:control.role||'admin',is_active:control.access!=='denied',read_only:Boolean(control.readOnly),messaging_write:true,production_blend_manage:true}]);
    if(name==='list_bids'){const r=wave2Response(url,{list_bids:tables.bids},137);return send(200,r.rows,r.headers);}
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
   if(req.method==='PATCH'&&name==='jobs'&&actor===owner){const id=url.searchParams.get('id')?.replace(/^eq\./,'');const job=tables.jobs.find(j=>j.id===id);if(!job)return send(404,{});Object.assign(job,body);return send(200,[job]);}
   if(req.method==='PATCH'&&name==='manpower_entries'&&actor===owner){
    const id=url.searchParams.get('id')?.replace(/^eq\./,'');const entry=tables.manpower_entries.find(r=>r.id===id);if(!entry)return send(404,{});
    Object.assign(entry,body,{updated_at:new Date().toISOString()});return send(200,entry);
   }
   if(!['GET','HEAD'].includes(req.method))return send(403,{message:'Unsupported disposable write'});
   const data=actor===owner?{...tables,my_work_messages:messages}:Object.fromEntries(Object.keys(tables).map(k=>[k,[]]));
   if(control.emptyManpower)data.manpower_entries=[];
   const result=wave2Response(url,data,137),single=req.headers.accept?.includes('vnd.pgrst.object'),payload=single?result.rows[0]??null:result.rows;
   call.rows=result.rows.length;call.bytes=Buffer.byteLength(JSON.stringify(payload));call.done=Date.now();return send(single&&!payload?406:200,payload,result.headers);
  }
  if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/api/')||url.pathname.startsWith('/__'))return send(403,{message:'No unsupported operations'});
  const root=path.resolve('out'),relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index';const file=[relative,relative+'.html',path.join(relative,'index.html')].map(p=>path.resolve(root,p)).find(p=>p.startsWith(root+path.sep)&&existsSync(p)&&statSync(p).isFile());if(!file)return send(404,{});
  let content=readFileSync(file);const ext=path.extname(file);if(ext==='.html'){
   const inject=hosted?'<style>body::before{content:"HOSTED READ-ONLY REVIEW · Unsupported reads and all business writes are blocked";position:fixed;bottom:0;right:0;z-index:9999;background:#fef9c3;padding:6px;font:11px system-ui;pointer-events:none}</style>':`<script>if(!localStorage.getItem('sb-localhost-auth-token'))localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(session()))});sessionStorage.setItem('tenops.welcomeHeroPlayed:${owner}','true');</script>`;
   content=Buffer.from(content.toString().replace('</head>',inject+'</head>'));
  }
  res.writeHead(200,{...security,'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.txt':'text/plain','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[ext]||'application/octet-stream'});res.end(content);
 }catch(error){send(502,{message:hosted?'Read-only review unavailable; no fallback':error.message});}
});server.on('upgrade',(_req,socket)=>socket.destroy());server.listen(port,'localhost',()=>console.log(`${origin} — ${hosted?'guarded hosted reads; normal sign-in; unsupported scenarios blocked':'one integrated application, synthetic data only'}`));
