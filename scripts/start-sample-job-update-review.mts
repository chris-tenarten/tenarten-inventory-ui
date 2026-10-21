// @ts-nocheck -- disposable review adapter, reused Sample fixtures and PDF renderer.
// Normal auth can be forwarded through the existing read-only guard; every
// business operation stays in memory. --fixture-auth is for unattended tests.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {pushReviewRpc,pushReviewScript,pushDemoScript,reviewPushEvent,reviewNotificationHistory} from './support/web-push-review-fixture.mjs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {renderProductionBlend} from '../supabase/functions/_shared/production-blend-pdf.ts';
import {buildProductionBlend} from '../supabase/functions/_shared/production-blend.mjs';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index.ts';
import {fixtureResponse,uuid,stamp} from './retrieval-review-fixture.mjs';
import {reviewSession} from './support/messaging-draft-review-fixture.mjs';
import {PREFIX,planRequest,forwardHeaders} from './support/read-only-review-guard.mjs';
const port=Number(process.env.SAMPLE_REVIEW_PORT||3000);
const origin=`http://localhost:${port}`,fixtureAuth=process.argv.includes('--fixture-auth');
const source=fixtureAuth?{}:Object.fromEntries(readFileSync('/Users/chrisngo/source/repos/tenarten-inventory-ui/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^(["'])(.*)\1$/,'$2')];}));
if(!fixtureAuth&&(!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(source.NEXT_PUBLIC_SUPABASE_URL)||!source.NEXT_PUBLIC_SUPABASE_ANON_KEY))throw Error('Expected hosted public auth configuration.');
const sampleId=uuid(710001),jobId=uuid(710002),hiddenId=uuid(710003),peerId=uuid(710004);
const snapshot=structuredClone(blendFixtures[4].snapshot);Object.assign(snapshot,{id:sampleId,sampleName:'Disposable Sample — Post to Job',colorPlateNumber:'T26-901-A',sampleSize:'6x6',sampleQuantity:'4'});
const snake=s=>s.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
const row=Object.fromEntries(Object.entries(snapshot).map(([k,v])=>[snake(k),v]));row.formulation_state=snapshot.formulation;row.blend_rows=snapshot.blendRows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[snake(k),v])));row.issued_documents=[];row.working_versions=[];
const sampleRows=[row];
const captured=snapshot.formulation.profile;
const reviewProfile={id:uuid(710030),revision:1,name:'Local captured Resin System',sort_order:1,is_active:true,chip_density:Number(captured.defaultChipDensityLbCft),dry_pool_rate:Number(captured.dryPoolOzPerCft),filler_rate:Number(captured.defaultFillerOzPerCft),resin_rate:Number(captured.resinFlOzPerCft),resin_parts:Number(captured.resinParts),hardener_parts:Number(captured.hardenerParts),batch_contract:captured.batchContract,batch_chip_target_lb:Number(captured.batchChipTargetLb),batch_reference_thickness_in:Number(captured.batchReferenceThicknessIn),description:'Disposable fixture from existing captured formulation'};
const baseJob={id:jobId,name:'Disposable Job — Sample review',customer:'Local review customer',job_number:'LOCAL-901',production_status:'not_started',material_status:'unknown',priority:'normal',progress_percent:0,created_at:stamp,updated_at:stamp,archived_at:null,contact_details:null};
const tables={vendors:[{id:uuid(710040),name:'Local mineral supplier',is_active:true,vendor_contacts:[]}],vendor_catalog:[{id:uuid(710041),vendor:'Local mineral supplier',item_name:'Local marble chips',category:'aggregate',material_class:'marble',unit:'lb',price:1}],vendor_catalog_v2:[],sample_operational_profiles:[reviewProfile],jobs:[baseJob],job_updates:[],job_attachments:[{id:uuid(710005),job_id:jobId,file_name:'Existing attachment.pdf',storage_path:jobId+'/existing.pdf',document_type:'other',mime_type:'application/pdf',size_bytes:10,created_at:stamp,job_update_id:null,job_update_attachment_role:null}]};
const pdfs=new Map();
const camel=s=>s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const workingSnapshot=(target=row)=>({...snapshot,...Object.fromEntries(Object.entries(target).map(([k,v])=>[camel(k),v])),formulation:target.formulation_state,blendRows:target.blend_rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[camel(k),v])))});
const pdf=async(key,value=snapshot)=>{if(!pdfs.has(key))pdfs.set(key,renderSampleWorkOrder(value));return pdfs.get(key);};
const blendPlan={id:uuid(710020),status:'issued',created_at:stamp,inputs:blendFixtures[4].inputs,source_snapshot:structuredClone(snapshot),model:buildProductionBlend(snapshot,blendFixtures[4].inputs)};
const objects=new Map(),requests=new Map(),notifications=[],calls=[],profiles=new Map();let failNext='',lostNext=false,pushControl={};
const allowed=p=>p?.is_active&&!p.read_only&&['admin','lead','member'].includes(p.role);
const server=createServer(async(req,res)=>{
 const send=(status,value,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});res.end(Buffer.isBuffer(value)||value instanceof Uint8Array?value:JSON.stringify(value));};
 try{
  if(req.headers.host!==`localhost:${port}`||req.headers.origin&&req.headers.origin!==origin)return send(403,{message:'Local origin only'});
  const url=new URL(req.url,origin),name=url.pathname.split('/').at(-1);let raw=Buffer.alloc(0);for await(const chunk of req){raw=Buffer.concat([raw,chunk]);if(raw.length>55*1024*1024)return send(413,{});}
  const isStorage=url.pathname.startsWith('/storage/v1/object/job-attachments/');
  let body={};if(raw.length&&!isStorage)body=JSON.parse(raw.toString());
  const auth=req.headers.authorization??'';
  const row=sampleRows.find(item=>item.id===(body.p_sample?.id||body.sampleId||body.p_sample_id))??sampleRows[0];
  let actor=reviewSession.user.id;try{actor=JSON.parse(Buffer.from(auth.split('.')[1],'base64url').toString()).sub;}catch{}
  if(process.env.WEB_PUSH_REVIEW==='true'&&url.pathname==='/__review/push-browser.js')return send(200,Buffer.from(pushReviewScript+pushDemoScript),{'content-type':'application/javascript'});
  if(process.env.WEB_PUSH_REVIEW==='true'&&url.pathname==='/__review/push-event'){const p=reviewPushEvent(url.searchParams.get('kind'),actor,jobId,peerId,url.searchParams.get('device'));if(p.kind==='mention')tables.job_updates.push({id:p.id,job_id:jobId,body:p.body,author_name:'Blair Lead',author_user_id:peerId,requires_follow_up:false,created_at:stamp,resolved_at:null,edited_at:null});return send(200,p);}
  if(process.env.WEB_PUSH_REVIEW==='true'&&url.pathname==='/__review/control'){pushControl=body;return send(200,true);}
  if(process.env.WEB_PUSH_REVIEW==='true'&&/^(can_view_my_web_push_|get_my_web_push_|register_my_web_push_|revoke_my_web_push_|set_my_web_push_|resolve_my_push_)/.test(name)){const result=await pushReviewRpc(name,body,actor,pushControl);return send(result.status,result.data);}
  if(url.pathname.startsWith('/auth/v1/')||url.pathname==='/rest/v1/rpc/get_my_app_access'){
   if(fixtureAuth){const profile={user_id:actor,display_name:process.env.WEB_PUSH_REVIEW==='true'?(actor.endsWith('900042')?'Review B':'Wave 4 Review'):'Local review Admin',role:'admin',is_active:true,read_only:false};profiles.set(auth,profile);return send(200,url.pathname.includes('get_my_app_access')?[profile]:name==='token'?reviewSession:reviewSession.user);}
   const plan=planRequest(PREFIX+url.pathname+url.search,req.method,body);if(!plan)return send(403,{message:'Auth operation blocked by read-only review guard'});
   const r=await fetch(new URL(plan.path,source.NEXT_PUBLIC_SUPABASE_URL),{method:plan.method,headers:{...forwardHeaders(req.headers,source.NEXT_PUBLIC_SUPABASE_ANON_KEY),...(plan.body?{'content-type':'application/json'}:{})},body:plan.body?JSON.stringify(plan.body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
   const data=await r.json();if(url.pathname.includes('get_my_app_access')&&r.ok)profiles.set(auth,data[0]);return send(r.status,data);
  }
  if(url.pathname==='/__review/state')return send(200,{sample:row,tables,notifications,calls,objectCount:objects.size});
  if(fixtureAuth&&url.pathname==='/__review/failure'){failNext=body.stage;lostNext=body.lost===true;return send(200,{});}
  const profile=profiles.get(auth);if(url.pathname.startsWith('/rest/')||url.pathname.startsWith('/functions/')||url.pathname.startsWith('/storage/')){
   if(!profile?.is_active)return send(403,{message:'Sign in to review',code:'42501'});
   calls.push({path:url.pathname,method:req.method,...(url.pathname.startsWith('/functions/')?{action:body.action,planId:body.planId}: {})});
  }
  if(isStorage){const key=decodeURIComponent(url.pathname.slice('/storage/v1/object/job-attachments/'.length));if(!allowed(profile)||!key.startsWith(jobId+'/sample-updates/'))return send(403,{message:'Not authorized'});if(failNext==='upload'){failNext='';return send(503,{message:'Disposable upload failure'});}if(objects.has(key))return send(409,{message:'The resource already exists',statusCode:'409'});const form=req.headers['content-type']?.startsWith('multipart/')?await new Response(raw,{headers:{'content-type':req.headers['content-type']}}).formData():null;const uploaded=form?form.get(''):null;objects.set(key,uploaded?Buffer.from(await uploaded.arrayBuffer()):raw);return send(200,{Key:'job-attachments/'+key});}
  if(url.pathname==='/storage/v1/object/job-attachments'&&req.method==='DELETE'){for(const key of body.prefixes??[])objects.delete(key);return send(200,[]);}
  if(url.pathname.startsWith('/storage/v1/object/sign/job-attachments/'))return send(200,{signedURL:'/object/public/job-attachments/'+url.pathname.split('/job-attachments/')[1]});
  if(url.pathname.startsWith('/storage/v1/object/public/job-attachments/')){const bytes=objects.get(decodeURIComponent(url.pathname.split('/job-attachments/')[1]));return bytes?send(200,bytes,{'content-type':'application/pdf'}):send(404,{});}
  if(url.pathname.startsWith('/review/pdf/')){const id=url.pathname.split('/').at(-1).replace(/\.pdf$/,'');const issued=sampleRows.flatMap(sample=>sample.issued_documents).find(d=>d.id===id);return send(200,await pdf(url.pathname,issued?{...issued.issued_snapshot,issue_number:issued.issue_number}:snapshot),{'content-type':'application/pdf'});}
  if(url.pathname==='/functions/v1/generate-sample-pdf'){
   if(failNext==='generation'&&!['blend-list','blend-context'].includes(body.action)){failNext='';return send(503,{message:'Disposable generation failure'});}
   if(body.action==='blend-context')return send(200,{snapshot});
   if(body.action==='blend-list')return send(200,[{id:blendPlan.id,status:blendPlan.status,created_at:stamp,identity:snapshot.colorPlateNumber,project:snapshot.projectName,planned_quantity:String(blendPlan.inputs.plannedQuantity)}]);
   if(body.action==='blend-pdf')return send(200,await renderProductionBlend(blendPlan),{'content-type':'application/pdf'});
   if(['working','preview','batch-working'].includes(body.action))return send(200,await pdf(url.pathname+row.id+(body.versionId??'')+JSON.stringify(row.formulation_state)+JSON.stringify(row.blend_rows)+row.updated_at,{...(body.versionId?workingSnapshot(row.working_versions.find(v=>v.id===body.versionId)?.snapshot??row):workingSnapshot(row)),render_context:'working'}),{'content-type':'application/pdf'});
   if(['generate','open'].includes(body.action))return send(200,{url:origin+'/review/pdf/'+body.documentId+'.pdf'});
   return send(403,{message:'Only local Sample PDF generation is allowed'});
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   if(process.env.WEB_PUSH_REVIEW==='true'&&name==='list_my_account_notification_history')return send(200,reviewNotificationHistory(actor));
   if(process.env.WEB_PUSH_REVIEW==='true'&&name==='list_my_work_inbox_recipients')return send(200,[{user_id:peerId,display_name:'Alex Operator',role:'member'}]);
   if(process.env.WEB_PUSH_REVIEW==='true'&&name==='list_my_work_message_page_v11')return send(200,[{id:uuid(710099),sender_user_id:peerId,sender_name:'Alex Operator',recipient_user_id:actor,recipient_name:'Local review',body:'Can you check the revised color plate before tomorrow?',created_at:stamp,read_at:null,attachments:[]}]);
   if(name==='mark_my_work_inbox_conversation_read'||name==='mark_my_account_notification_read')return send(200,null);
   if(name==='list_bids')return send(200,[],{'content-range':'*/0'});
   if(name==='list_samples')return send(200,sampleRows.map(sample=>({sample})));
   if(name==='suggest_sample_color_plate_number')return send(200,`T26-${901+sampleRows.length}-A`);
   if(name==='create_sample_with_formulation'){
    const created={...structuredClone(row),...body.p_sample,id:uuid(710100+sampleRows.length),color_plate_number:body.p_sample.color_plate_number||'T26-902-A',blend_rows:body.p_rows,working_versions:[],issued_documents:[]};sampleRows.push(created);return send(200,{id:created.id,color_plate_number:created.color_plate_number});
   }
   if(name==='save_sample_working_version'){const id=uuid(750000+sampleRows.reduce((n,s)=>n+s.working_versions.length,0));const {working_versions,issued_documents,...current}=row;row.working_versions.unshift({id,sample_id:row.id,version_number:row.working_versions.length+1,version_note:body.p_note,saved_at:stamp,saved_by_name:'Local review Admin',snapshot:structuredClone(current)});return send(200,id);}
   if(name==='restore_sample_working_version'){const version=row.working_versions.find(v=>v.id===body.p_version_id);if(!version)return send(404,{message:'Unknown local version'});const history=row.working_versions,issued=row.issued_documents;Object.assign(row,structuredClone(version.snapshot),{working_versions:history,issued_documents:issued});return send(200,null);}
   if(name==='get_sample_formulation_default')return send(200,{});
   if(name==='save_sample_draft'){Object.assign(row,body.p_sample,{updated_at:new Date().toISOString()});row.blend_rows=body.p_rows;return send(200,null);}
   if(name==='record_my_sample_recent_values')return send(200,null);
   if(name==='create_sample')return send(200,sampleId);
   if(name==='issue_sample_form'){const id=uuid(720000+sampleRows.reduce((n,s)=>n+s.issued_documents.length,0));row.issued_documents.push({id,sample_id:row.id,issue_number:row.issued_documents.length+1,issued_at:stamp,generation_status:'generated',snapshot_hash:'fixture-issued-'+id,issued_snapshot:structuredClone(workingSnapshot(row))});return send(200,id);}
   if(name==='search_sample_update_jobs')return send(200,allowed(profile)&&[baseJob.name,baseJob.customer,baseJob.job_number].join(' ').toLowerCase().includes((body.p_search??'').toLowerCase())?[baseJob]:[]);
   if(name==='can_publish_sample_to_job')return send(200,allowed(profile)&&body.p_job_id===jobId);
   if(name==='list_active_job_update_collaborators')return send(200,[{user_id:peerId,display_name:'Review Colleague',role:'member'}]);
   if(name==='publish_sample_job_update'){
    if(!allowed(profile)||body.p_job_id!==jobId)return send(403,{message:'Posting denied',code:'42501'});
    const key=jobId+'/sample-updates/'+body.p_request_id+'.pdf';if(requests.has(key))return send(200,requests.get(key));
    if(failNext==='post'){failNext='';return send(400,{message:'Disposable post failure',code:'22023'});}
    if(!objects.has(key))return send(400,{message:'Upload missing',code:'22023'});
    const update={id:uuid(730000+tables.job_updates.length),job_id:jobId,body:body.p_body.trim()||'Sample document: '+body.p_filename,author_name:profile.display_name,author_user_id:profile.user_id,requires_follow_up:false,created_at:new Date().toISOString(),resolved_at:null,edited_at:null};
    tables.job_updates.push(update);tables.job_attachments.push({id:uuid(740000+tables.job_attachments.length),job_id:jobId,file_name:body.p_filename,storage_path:key,document_type:body.p_document_type,mime_type:'application/pdf',size_bytes:objects.get(key).length,job_update_id:update.id,job_update_attachment_role:'update',created_at:update.created_at});requests.set(key,update);
    for(const userId of new Set(body.p_mentioned_user_ids??[]))notifications.push({userId,updateId:update.id,key:'job-update-mention:'+update.id});
    if(lostNext){lostNext=false;return send(503,{message:'Disposable lost response'});}return send(200,update);
   }
   if(name==='list_job_update_mentions')return send(200,notifications.map(n=>({update_id:n.updateId,user_id:n.userId,display_name:'Review Colleague',is_active:true})));
   if(/^(get_|list_|search_|suggest_)/.test(name))return send(200,[]);
   if(['mark_my_job_updates_seen','ensure_my_welcome_notification'].includes(name))return send(200,null);
   return send(403,{message:'Nonlocal business operation blocked'});
  }
  if(url.pathname.startsWith('/rest/v1/')&&['GET','HEAD'].includes(req.method)){const r=fixtureResponse(url,tables);return send(200,req.headers.accept?.includes('vnd.pgrst.object')?r.rows[0]??null:r.rows,r.headers);}
  if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/api/'))return send(403,{message:'No hosted business writes permitted'});
  const root=path.resolve('out'),relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index';const file=[relative,relative+'.html',path.join(relative,'index.html')].map(f=>path.resolve(root,f)).find(f=>f.startsWith(root+path.sep)&&existsSync(f)&&statSync(f).isFile());if(!file)return send(404,{});
  const ext=path.extname(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain'})[ext]||'application/octet-stream','content-security-policy':"default-src 'self'; connect-src 'self' blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'"});let data=readFileSync(file);if(ext==='.html'&&process.env.WEB_PUSH_REVIEW==='true')data=Buffer.from(data.toString().replace('</head>',`<script src="/__review/push-browser.js"></script><script>if(!localStorage.getItem('sb-localhost-auth-token'))localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(reviewSession))});</script></head>`));res.end(data);
 }catch(e){send(500,{message:e.message});}
});
server.listen(port,'localhost',()=>console.log(`Local disposable review: ${origin}/samples?open=${sampleId} — ${fixtureAuth?'fixture auth for tests':'normal TenOps sign-in; hosted business writes blocked'}`));
