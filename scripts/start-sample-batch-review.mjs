// Disposable local database + actual exported /samples application. No hosted credentials or traffic.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {startDatabase,sql,docker,asUser,json,literal,admin,provision,provisionReference} from './support/sample-batch-database.mjs';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index.ts';
const port=4207, host='127.0.0.1', origin=`http://${host}:${port}`,container=`tenops-sample-batch-review-${process.pid}`;
const output='/private/tmp/tenops-sample-batch-review';mkdirSync(output,{recursive:true});
const call=expr=>sql(container,asUser(`select ${expr}`));
const parsed=expr=>{const r=call(expr);return r?JSON.parse(r):null;};
const user={id:admin,aud:'authenticated',role:'authenticated',email:'local-review@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-09-30T00:00:00Z'};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:admin,role:'authenticated',aud:'authenticated',exp:4102444800})).toString('base64url')}.local`;
const session={access_token:token,refresh_token:'local-review',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};
const uuid=value=>{if(!/^[0-9a-f-]{36}$/i.test(value??''))throw new Error('Invalid local fixture identifier');return literal(value)+'::uuid';};
const writes=[];let sampleId;
try{
 startDatabase(container);const pid=provision(container);provisionReference(container,pid);
 sampleId=call('public.create_sample()');
 const state=parsed(`formulation_state from samples where id=${uuid(sampleId)}`);
 const profile=parsed(`to_jsonb(p) from sample_operational_profiles p where id=${uuid(pid)}`);
 state.profile={...state.profile,id:'operational:'+pid,version:profile.revision,name:'MTT — 5:1',dryPoolOzPerCft:'2560',defaultFillerOzPerCft:'512',batchChipTargetLb:'180',batchReferenceThicknessIn:String(profile.batch_reference_thickness_in),evidence:profile.description};
 const blend=[...[[40,'Blanco #1'],[30,'Blanco #2'],[20,'MOP'],[5,'True Grey #1'],[5,'True Grey #2']].map(([p,color])=>({percentage:String(p),color,component_role:'aggregate',calculation_basis:'target_total',quantity_provenance:'calculated',unit:'oz',vendor:''})),...['filler','resin','hardener'].map(component_role=>({color:component_role==='filler'?'ATF-20':component_role==='resin'?'Resin':'Hardener',component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz',vendor:''}))];
 call(`public.save_sample_draft(${json({id:sampleId,prepared_by:'Marcos',project_name:'',sample_size:'6x6',sample_quantity:'1',formulation_state:state})},${json(blend)},'MTT Batch review')`);
 const route=`${origin}/samples?open=${sampleId}`;writeFileSync(path.join(output,'server.json'),JSON.stringify({container,route,sampleId}));
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,origin);const name=url.pathname.split('/').at(-1);
  if(req.headers.origin&&!['http://localhost:4207',origin].includes(req.headers.origin)){res.writeHead(403).end();return;}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':req.headers.origin||origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,HEAD,OPTIONS'}).end();return;}
  try{
   let body={};if(req.method==='POST'){let raw='';for await(const part of req){raw+=part;if(raw.length>2000000)throw new Error('Oversize request');}body=raw?JSON.parse(raw):{};}
   let result;
   if(url.pathname.startsWith('/auth/v1/'))result=name==='token'?session:user;
   else if(url.pathname==='/review/evidence')result={writes,sampleId,container};
   else if(url.pathname==='/functions/v1/generate-sample-pdf'){
    let snapshot,version;
    if(body.action==='preview')snapshot=body.snapshot;
    else if(body.action==='working')snapshot=parsed(`public.get_sample_working_pdf_snapshot(${uuid(body.sampleId)},${body.versionId?uuid(body.versionId):'null'})`);
    else if(['generate','open'].includes(body.action)){
     const d=parsed(`to_jsonb(d) from sample_issued_documents d where id=${uuid(body.documentId)}`);snapshot=d.issued_snapshot;version=d.document_version;
     const filename=`issued-${body.documentId}.pdf`;if(!existsSync(path.join(output,filename)))writeFileSync(path.join(output,filename),await renderSampleWorkOrder(snapshot,version));
     result={url:`${origin}/review/pdf/${filename}`};
    }else throw new Error('Unsupported local PDF operation');
    if(!result){const bytes=await renderSampleWorkOrder(snapshot,version);writeFileSync(path.join(output,'working.pdf'),bytes);res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'no-store'}).end(bytes);return;}
   }else if(url.pathname.startsWith('/review/pdf/')){const file=path.join(output,path.basename(url.pathname));res.writeHead(200,{'Content-Type':'application/pdf'}).end(readFileSync(file));return;}
   else if(url.pathname.startsWith('/rest/v1/rpc/')){
    const b=body;
    if(name==='get_my_app_user')result=[{user_id:admin,display_name:'Local review Admin',role:'admin',is_active:true}];
    else if(name==='list_samples')result=parsed("coalesce(jsonb_agg(jsonb_build_object('sample',t)),'[]'::jsonb) from public.list_samples(null) t");
    else if(name==='get_sample_formulation_default')result=parsed('public.get_sample_formulation_default()');
    else if(name==='create_sample'){result=call('public.create_sample()');writes.push({name,body});}
    else if(name==='save_sample_draft'){call(`public.save_sample_draft(${json(b.p_sample)},${json(b.p_rows)},${literal(b.p_sample_name??'')})`);result=null;writes.push({name,body});}
    else if(name==='save_sample_operational_profile'){result=call(`public.save_sample_operational_profile(${b.p_id?uuid(b.p_id):'null'},${b.p_expected_revision==null?'null':Number(b.p_expected_revision)},${json(b.p_values)})`);writes.push({name,body});}
    else if(name==='save_sample_working_version'){result=call(`public.save_sample_working_version(${uuid(b.p_sample_id)},${literal(b.p_note??'')})`);writes.push({name,body});}
    else if(name==='restore_sample_working_version'){call(`public.restore_sample_working_version(${uuid(b.p_sample_id)},${uuid(b.p_version_id)})`);result=null;writes.push({name,body});}
    else if(name==='issue_sample_form'){result=call(`public.issue_sample_form(${uuid(b.p_sample_id)})`);writes.push({name,body});}
    else if(name==='duplicate_sample'){result=call(`public.duplicate_sample(${uuid(b.p_sample_id)},true)`);writes.push({name,body});}
    else if(name==='has_app_capability')result=true;
    else result=[]; // unrelated shell read fixtures; never forward to a hosted service
   }else if(url.pathname.startsWith('/rest/v1/')){
    result=name==='sample_operational_profiles'?parsed("coalesce(jsonb_agg(p order by sort_order),'[]'::jsonb) from sample_operational_profiles p"):[];
   }else{
    const root=path.resolve('out');const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index';
    const file=[relative,relative+'.html',path.join(relative,'index.html')].map(f=>path.resolve(root,f)).find(f=>f.startsWith(root+path.sep)&&existsSync(f)&&statSync(f).isFile());
    if(!file){res.writeHead(404).end('Not found');return;}
    const ext=path.extname(file);let data=readFileSync(file);
    if(ext==='.html')data=Buffer.from(data.toString().replace('</head>',`<script>localStorage.setItem('sb-127-auth-token',${JSON.stringify(JSON.stringify(session))});</script></head>`));
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain'})[ext]||'application/octet-stream'}).end(data);return;
   }
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Content-Range':Array.isArray(result)?`0-${Math.max(0,result.length-1)}/${result.length}`:'0-0/1','Access-Control-Allow-Origin':req.headers.origin||origin}).end(JSON.stringify(result));
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({message:e.message,code:'LOCAL_REVIEW'}));}
 });
 server.listen(port,host,()=>console.log(`Actual Sample Generator with disposable PostgreSQL: ${route}`));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close();docker(['stop',container]);process.exit(0);});
}catch(e){try{docker(['stop',container]);}catch{}throw e;}
