// @ts-nocheck -- Task-owned local adapter over real PostgreSQL RPCs; no hosted forwarding.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {startIntakeDatabase,sql,docker,value,literal,json,admin,asUser} from './support/intake-materials-database.mjs';
import {handleBidScope} from '../supabase/functions/_shared/bid-scope-handler.ts';
import {handleProductionBlend} from '../supabase/functions/_shared/production-blend-handler.ts';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index.ts';
import {blendClients} from './support/production-blend-database.mjs';
const port=Number(process.env.REVIEW_PORT||3000),origin=`http://localhost:${port}`,container='tenops-intake-review-'+process.pid,output='/private/tmp/tenops-intake-materials-review';mkdirSync(output,{recursive:true});
const parsed=(expression,role='authenticated')=>{const r=value(container,expression,admin,role);return r?JSON.parse(r):null;};
const user={id:admin,aud:'authenticated',role:'authenticated',email:'local-intake@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-10-26T00:00:00Z'};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:admin,role:'authenticated',aud:'authenticated',exp:4102444800})).toString('base64url')}.local`;
const session={access_token:token,refresh_token:'local-intake',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};
const writes=[],originals=new Map();
const scalar=v=>v===null?'null':typeof v==='object'?json(v):literal(v);
const rpcNames=new Set(['intake_workflow_summaries','list_bids','list_bid_owners','list_bid_activity','list_bid_updates','list_bid_files','create_bid','update_bid','create_bid_update','set_bid_projected_window','convert_bid_to_production','has_app_capability','list_samples','get_sample_formulation_default','create_sample','save_sample_draft','create_sample_with_formulation','suggest_sample_color_plate_number','save_sample_working_version','restore_sample_working_version','issue_sample_form','has_proposal_access','list_bid_scope_sources','bid_scope_context','bid_material_supply','begin_historical_sample_import','verify_historical_sample','persist_historical_sample','persist_bid_scope']);
function rpc(name,args={},role='authenticated'){
 try{if(['get_my_app_user','get_my_app_access'].includes(name))return {data:parsed(`coalesce(jsonb_agg(u),'[]') from app_users u where user_id=${literal(admin)}`)};
 if(!rpcNames.has(name))return {data:[]};
 if(name==='convert_bid_to_production')writes.push({name:'conversion-attempt',expected:args.p_expected_updated_at,actual:value(container,`updated_at from bids where id=${literal(args.p_bid_id)}`)});
 const call=`public.${name}(${Object.entries(args).map(([k,v])=>{if(!/^p_[a-z0-9_]+$/.test(k))throw Error('Invalid parameter');return `${k}=>${scalar(v)}`;}).join(',')})`;
 const isList=(name.startsWith('list_')||name==='intake_workflow_summaries')&&!['list_bid_scope_sources'].includes(name);
 const data=name==='list_samples'?parsed(`coalesce(jsonb_agg(jsonb_build_object('sample',x.sample)),'[]') from ${call} x`,role):parsed(isList?`coalesce(jsonb_agg(x),'[]') from ${call} x`:`to_jsonb(${call})`,role);
 if(!/^(list_|get_|has_|suggest_|bid_scope_context|bid_material_supply|intake_workflow_summaries)/.test(name))writes.push({name,at:new Date().toISOString()});
 return {data};
 }catch(e){return {error:{message:e.message,code:'LOCAL_REVIEW'}};}
}
const tables=new Set(['bids','jobs','bid_scope_captures','job_bid_scope_handoffs','historical_sample_imports','historical_sample_verifications','sample_operational_profiles','sample_issued_documents','production_blend_plans','proposal_access_users','proposals']);
function from(table){let columns='*',filters=[],order='',limit='';const q={select(c='*'){columns=c;return q;},eq(k,v){if(!/^[a-z_]+$/.test(k))throw Error('Invalid filter');filters.push(`${k}=${scalar(v)}`);return q;},is(k,v){filters.push(`${k} is ${v===null?'null':scalar(v)}`);return q;},order(k,opts){if(/^[a-z_]+$/.test(k)&&!order)order=`order by ${k} ${opts?.ascending===false?'desc':'asc'}`;return q;},limit(n){limit=`limit ${Number(n)}`;return q;},range(a,b){limit=`limit ${Number(b)-Number(a)+1} offset ${Number(a)}`;return q;},abortSignal(){return q;},returns(){return q;},single:async()=>{const r=await q;return {data:r.data?.[0]??null,error:r.error||(!r.data?.[0]?{message:'Not found'}:null)};},maybeSingle:async()=>{const r=await q;return {data:r.data?.[0]??null,error:r.error};},then(resolve,reject){try{
 if(!tables.has(table))return Promise.resolve({data:[],count:0}).then(resolve,reject);
 if(!/^[a-z_,*]+$/.test(columns))columns='*';
 const data=parsed(`coalesce(jsonb_agg(x),'[]') from (select ${columns} from public.${table} ${filters.length?'where '+filters.join(' and '):''} ${order} ${limit}) x`);return Promise.resolve({data,count:data.length}).then(resolve,reject);
 }catch(e){return Promise.resolve({error:{message:e.message}}).then(resolve,reject);}}};return q;}
const client={rpc:async(name,args)=>rpc(name,args),from,auth:{getUser:async()=>({data:{user}})},storage:{from:()=>({download:async key=>{const file=originals.get(key);return file?{data:new Blob([readFileSync(file)])}:{error:{message:'Original unavailable'}};}})}};
try{
 startIntakeDatabase(container);
 const bid=value(container,"create_bid('Local review customer','Intake graduation — two finishes')");
 const sample=value(container,'create_sample()');const state=parsed(`formulation_state from samples where id=${literal(sample)}`);
 const rows=[{percentage:'60',color:'Local White',size:'#1',material_type:'Marble',vendor:'Local supplier',unit:'oz',component_role:'aggregate',quantity_provenance:'calculated',calculation_basis:'target_total'},{percentage:'40',color:'Local Grey',size:'#1',material_type:'Marble',vendor:'Local supplier',unit:'oz',component_role:'aggregate',quantity_provenance:'calculated',calculation_basis:'target_total'},...['filler','resin','hardener'].map(role=>({color:role==='filler'?'Local Filler':role==='resin'?'Local Resin':'Local Hardener',component_role:role,quantity_provenance:'calculated',unit:role==='filler'?'oz':'fl oz'}))];
 value(container,`save_sample_draft(${json({id:sample,prepared_by:'Local review Admin',sample_size:'6 x 6',sample_quantity:'4',color_plate_number:'T26-497-A',project_name:'Local review source',approved_date:'2026-10-26',formulation_state:state})},${json(rows)},'Local formulation')`);
 value(container,`save_sample_working_version(${literal(sample)},'Reviewed local formulation')`);
 sql(container,`insert into inventory_items(vendor,color,size,category,quantity,unit) values('Local supplier','Local White','#1','chip',4,'Bags'),('Local supplier','Local Grey','#1','chip',1,'Bags');insert into inventory_items(vendor,color,size,category,quantity,unit,temporary_job_label) values('Local supplier','Local White','#1','chip',10,'Bags','Other work');insert into pending_receivals(vendor,material_name,size,category,quantity_expected,quantity_received,unit,eta) values('Local supplier','Local Grey','#1','chip',5,0,'Bags','2026-11-15');`);
 const proposal=crypto.randomUUID();sql(container,`insert into proposals(id,lineage_id,estimate_base,estimate_number,status,customer_name,project_name,created_by_user_id,created_by_name,issued_at,issued_snapshot) values(${literal(proposal)},${literal(proposal)},'Q26-1026','Q26-1026-1.0','issued','Local review customer','Intake graduation',${literal(admin)},'Local Admin',now(),'{}');insert into bid_proposal_relationships(bid_id,proposal_id,linked_by_user_id) values(${literal(bid)},${literal(proposal)},${literal(admin)});`);
 writeFileSync(path.join(output,'server.json'),JSON.stringify({container,port,origin,bid,sample,pid:process.pid},null,2));
 const server=createServer(async(req,res)=>{
 const url=new URL(req.url,origin);const endpoint=url.pathname.split('/').at(-1);const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-upsert','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS,HEAD','Cache-Control':'no-store'};
 if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403).end();return;}if(req.method==='OPTIONS'){res.writeHead(204,headers).end();return;}
 try{let raw=Buffer.alloc(0);for await(const p of req){raw=Buffer.concat([raw,p]);if(raw.length>22*1024*1024)throw Error('Request too large');}const body=raw.length&&req.headers['content-type']?.includes('json')?JSON.parse(raw.toString()):{};let result;
 if(url.pathname.startsWith('/auth/v1/'))result=endpoint==='token'?session:user;
 else if(url.pathname==='/review/evidence')result={writes,container,bid,sample};
 else if(url.pathname==='/functions/v1/generate-sample-pdf'){
  if(body.action?.startsWith('scope-')||body.action==='historical-complete'){const response=await handleBidScope({user:client,service:{rpc:async(n,a)=>rpc(n,a,'service_role')},body,headers});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
  if(body.action?.startsWith('blend-')){const response=await handleProductionBlend({...blendClients(container),body,headers});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
  let snapshot;if(body.action==='preview')snapshot=body.snapshot;else if(body.action==='working')snapshot=parsed(`get_sample_working_pdf_snapshot(${literal(body.sampleId)},${body.versionId?literal(body.versionId):'null'})`);else if(['generate','open'].includes(body.action)){snapshot=parsed(`issued_snapshot from sample_issued_documents where id=${literal(body.documentId)}`);}else throw Error('Unsupported local PDF operation');
  const bytes=await renderSampleWorkOrder(snapshot);if(['generate','open'].includes(body.action)){const file=`issued-${body.documentId}.pdf`;writeFileSync(path.join(output,file),bytes);sql(container,`update sample_issued_documents set generation_status='generated',generated_at=now(),storage_path=${literal('local/'+file)} where id=${literal(body.documentId)}`);writes.push({name:'sample-pdf-rendered',id:body.documentId});result={url:`${origin}/review/files/${file}`};}else{res.writeHead(200,{...headers,'Content-Type':'application/pdf'}).end(bytes);return;}
 }else if(url.pathname.startsWith('/storage/v1/object/')){
  const parts=url.pathname.split('/');if(req.method==='GET'){const key=decodeURIComponent(parts.slice(6).join('/'));const file=originals.get(key);if(!file)throw Error('Original unavailable');res.writeHead(200,{...headers,'Content-Type':'application/octet-stream'}).end(readFileSync(file));return;}else if(parts[4]==='sign'){const key=decodeURIComponent(parts.slice(6).join('/'));result={signedURL:`/object/sign/historical-samples/${key}?local=1`};}
  else {const bucket=parts[4],key=decodeURIComponent(parts.slice(5).join('/'));if(bucket!=='historical-samples')throw Error('Unsupported review bucket');if(originals.has(key))throw Error('Original already exists');sql(container,asUser(`insert into storage.objects(bucket_id,name) values('historical-samples',${literal(key)})`));const dest=path.join(output,'original-'+crypto.randomUUID());let bytes=raw;if(req.headers['content-type']?.includes('multipart/form-data')){const form=await new Response(raw,{headers:{'Content-Type':req.headers['content-type']}}).formData();const file=[...form.values()].find(v=>v instanceof Blob);if(!file)throw Error('Original file missing');bytes=Buffer.from(await file.arrayBuffer());}writeFileSync(dest,bytes);originals.set(key,dest);result={Key:key};}
 }else if(url.pathname.startsWith('/review/original/')){const file=originals.get(decodeURIComponent(url.pathname.slice('/review/original/'.length)));if(!file)throw Error('Original unavailable');res.writeHead(200,{'Content-Type':'application/octet-stream'}).end(readFileSync(file));return;}
 else if(url.pathname.startsWith('/review/files/')){const file=path.join(output,path.basename(url.pathname));res.writeHead(200,{'Content-Type':'application/pdf'}).end(readFileSync(file));return;}
 else if(url.pathname.startsWith('/rest/v1/rpc/')){const r=rpc(endpoint,body);if(r.error)throw Error(r.error.message);result=r.data;}
 else if(url.pathname.startsWith('/rest/v1/')){
  if(endpoint==='bid_proposal_relationships'){const id=url.searchParams.get('bid_id')?.replace(/^eq\./,'');result=parsed(`coalesce(jsonb_agg(jsonb_build_object('proposal_id',p.id,'proposal',to_jsonb(p))),'[]') from bid_proposal_relationships r join proposals p on p.id=r.proposal_id where r.bid_id=${literal(id)}`);}
  else{const q=from(endpoint).select(url.searchParams.get('select')||'*');for(const [k,v] of url.searchParams){if(v.startsWith('eq.'))q.eq(k,v.slice(3));if(k==='order')q.order(v.split('.')[0],{ascending:!v.includes('.desc')});}const r=await q;if(r.error)throw Error(r.error.message);result=r.data;}
 }else{
 const root=path.resolve('out'),relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index';const file=[relative,relative+'.html',path.join(relative,'index.html')].map(f=>path.resolve(root,f)).find(f=>f.startsWith(root+path.sep)&&existsSync(f)&&statSync(f).isFile());if(!file){res.writeHead(404).end('Not found');return;}
 let data=readFileSync(file);const ext=path.extname(file);if(ext==='.html')data=Buffer.from(data.toString().replace('</head>',`<script>localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(session))});</script></head>`));res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.mjs':'application/javascript'})[ext]||'application/octet-stream'}).end(data);return;
 }
 if(Array.isArray(result)&&req.headers.accept?.includes('vnd.pgrst.object')){if(result.length!==1)throw Error('Expected one local record');result=result[0];}
 res.writeHead(200,{...headers,'Content-Type':'application/json','Content-Range':Array.isArray(result)?`0-${Math.max(0,result.length-1)}/${result.length}`:'0-0/1'}).end(JSON.stringify(result));
 }catch(e){res.writeHead(400,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({message:e.message,code:'LOCAL_REVIEW'}));}
 });
 server.listen(port,'::1',()=>console.log(`Local Intake candidate: ${origin}/pre-production (disposable PostgreSQL ${container})`));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close();docker(['stop',container]);process.exit(0);});
}catch(e){try{docker(['stop',container]);}catch{}throw e;}
