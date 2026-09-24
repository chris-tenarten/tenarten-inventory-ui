/** Prepared Storage lifecycle runner. No SQL execution; no network in default plan mode. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const raw=readFileSync('scripts/fixtures/intake-demo-final/manifest.json');
const manifest=JSON.parse(raw),digest=data=>createHash('sha256').update(data).digest('hex');
const manifestHash=digest(raw),arg=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3);
const mode=arg('mode')??'plan';
if(!['plan','preflight','upload','remove'].includes(mode))throw Error('Mode must be plan, preflight, upload or remove');
for(const r of manifest.records){const bytes=readFileSync(r.attachment.local_path);if(digest(bytes)!==r.attachment.sha256||bytes.length!==r.attachment.byte_size)throw Error('Local PDF differs from manifest');}
if(mode==='plan'){
 console.log(JSON.stringify({mode,manifest_sha256:manifestHash,networkRequests:0,objects:manifest.records.map(r=>({bid:r.fields.project_name,...r.attachment}))},null,2));
}else{
 if(arg('approved-manifest-sha256')!==manifestHash)throw Error('Explicit approval of the exact manifest SHA-256 is required');
 const base=process.env.TENOPS_DEMO_SUPABASE_URL;
 const key=process.env.TENOPS_DEMO_PUBLIC_KEY,token=process.env.TENOPS_DEMO_CHRIS_ACCESS_TOKEN;
 const storageReadKey=process.env.TENOPS_DEMO_STORAGE_SERVICE_KEY;
 if(base!=='https://vxdxjhazkqhpkwdqtobp.supabase.co'||!key||!token||!storageReadKey)throw Error('Set the exact approved backend URL, public API key Chris authenticated session token, and scoped-use Storage service credential explicitly');
 const headers={apikey:key,Authorization:`Bearer ${token}`};
 async function request(path,options={}){return fetch(base+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30000)});}
 async function json(path,options={}){const r=await request(path,options);if(!r.ok)throw Error(`Request failed ${r.status} at ${path.split('?')[0]}; stop and inspect before retry`);return r.status===204?null:r.json();}
 // Normal Storage SELECT hides uploading objects, even from the uploader.
 // Read only the eight exact fixture paths with a service credential to verify
 // bytes before finalization/resume. Upload/delete still use Chris's normal token.
 async function objectState(file){
  const response=await request(`/storage/v1/object/authenticated/${file.bucket}/${file.storage_path}`,{headers:{apikey:storageReadKey,Authorization:`Bearer ${storageReadKey}`}});
  if(response.ok)return {exists:true,bytes:Buffer.from(await response.arrayBuffer())};
  if(response.status===404)return {exists:false};
  if(response.status===400){const error=await response.json().catch(()=>null);if(String(error?.statusCode)==='404'&&['not_found','NotFound'].includes(error?.error))return {exists:false};}
  throw Error(`Cannot establish fixture object state (${response.status}); stop`);
 }
 const user=await json('/auth/v1/user');if(user.id!==manifest.owner.user_id)throw Error('Authenticated user is not the reviewed owner Chris Ngo');
 const profile=await json('/rest/v1/rpc/get_my_app_user',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 const actor=Array.isArray(profile)?profile[0]:profile;
 if(actor?.user_id!==manifest.owner.user_id||actor?.display_name!=='Chris Ngo'||actor?.role!=='admin'||!actor?.is_active)throw Error('Chris active Admin identity changed');
 const select=(table,filter)=>json(`/rest/v1/${table}?${new URLSearchParams({select:'*',...filter})}`);
 const matches=(actual,expected)=>Object.entries(expected).every(([k,v])=>JSON.stringify(actual[k])===JSON.stringify(v));
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
 const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const checked=[];
 // Validate every fixture and object before the first Storage mutation.
 for(const record of manifest.records){
  const {fields:b,attachment:f}=record;
  const [bids,files,links,updates,activity,samples,proposals]=await Promise.all([
   select('bids',{id:`eq.${b.id}`}),select('canonical_files',{id:`eq.${f.id}`}),
   select('bid_file_relationships',{or:`(bid_id.eq.${b.id},file_id.eq.${f.id})`}),
   select('bid_updates',{bid_id:`eq.${b.id}`}),select('bid_activity',{bid_id:`eq.${b.id}`}),
   select('samples',{bid_id:`eq.${b.id}`}),select('bid_proposal_relationships',{bid_id:`eq.${b.id}`}),
  ]);
  if(!bids.length&&(mode==='remove'||mode==='preflight')){
   if(files.length||links.length||updates.length||activity.length||samples.length||proposals.length)throw Error('Missing Bid has dependent metadata; stop');
   const orphan=await objectState(f);
   if(orphan.exists)throw Error('Unexpected object or unconfirmed absence for already-removed Bid');
   continue;
  }
  if(bids.length!==1||!matches(bids[0],b))throw Error(`Bid changed/converted or missing: ${b.project_name}`);
  if(samples.length||proposals.length)throw Error('Linked canonical documents require separate cleanup review');
  if(files.length!==1||!matches(files[0],{id:f.id,uploader_user_id:manifest.owner.user_id,storage_bucket:f.bucket,storage_path:f.storage_path,original_filename:f.filename,content_type:f.content_type,byte_size:f.byte_size}))throw Error('File metadata differs');
  if(links.length!==1||links[0].bid_id!==b.id||links[0].file_id!==f.id)throw Error('Shared or unexpected file relationship');
  if(mode==='remove'&&links[0].relationship_state!=='removal_pending')throw Error('Run reviewed prepare-cleanup SQL first');
  if(mode!=='remove'&&!((files[0].lifecycle_state==='uploading'&&links[0].relationship_state==='uploading')||(files[0].lifecycle_state==='ready'&&links[0].relationship_state==='active')))throw Error('Unexpected upload lifecycle');
  if(updates.length!==record.updates.length||updates.some(u=>!record.updates.some(e=>e.id===u.id&&e.body===u.body&&u.author_user_id===manifest.owner.user_id)))throw Error('Demo Updates changed');
  const additions=activity.filter(a=>a.activity_type==='file_added');
  if(additions.length>1||additions.some(a=>a.actor_user_id!==manifest.owner.user_id||!same(a.details,{file_id:f.id})))throw Error('Unexpected attachment activity');
  if(files[0].lifecycle_state==='ready'&&additions.length!==1)throw Error('Ready file lacks normal file-added activity');
  const baseEvents=activity.filter(a=>a.activity_type!=='file_added');
  if(baseEvents.length!==record.activities.length||baseEvents.some(a=>!record.activities.some(e=>e.id===a.id&&e.activity_type===a.activity_type&&same(e.details,a.details)&&a.actor_user_id===manifest.owner.user_id)))throw Error('Demo history changed');
  const object=await objectState(f);
  const exists=object.exists;
  if(exists&&digest(object.bytes)!==f.sha256)throw Error('Existing object bytes differ; never overwrite/remove it');
  if(mode!=='remove'&&files[0].lifecycle_state==='ready'&&!exists)throw Error('Ready metadata but missing object; separate recovery review');
  checked.push({record,exists,ready:files[0].lifecycle_state==='ready'});
 }
 const completed=[];
 if(mode==='preflight'){console.log(JSON.stringify({mode,status:'read-only preflight complete',existingFixtures:checked.length,manifest_sha256:manifestHash},null,2));}
 else try{
  for(const {record,exists,ready} of checked){
   const f=record.attachment;
   if(mode==='upload'){
    if(!exists){
     const uploaded=await request(`/storage/v1/object/${f.bucket}/${f.storage_path}`,{method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:readFileSync(f.local_path)});
     if(!uploaded.ok)throw Error(`Upload result ${uploaded.status}; do not assume failure/absence, rerun preflight to reconcile`);
    }
    const object=await objectState(f);
    if(!object.exists||digest(object.bytes)!==f.sha256)throw Error('Post-upload byte verification failed');
    if(!ready)await json('/rest/v1/rpc/finalize_bid_file_upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_file_id:f.id})});
    const file=(await select('canonical_files',{id:`eq.${f.id}`}))[0];
    if(file?.lifecycle_state!=='ready')throw Error('Finalization not confirmed');
   }else{
    if(exists)await json(`/storage/v1/object/${f.bucket}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[f.storage_path]})});
    const object=await objectState(f);
    if(object.exists)throw Error('Object absence not confirmed; do not run finish-cleanup SQL');
   }
   completed.push(f.storage_path);
  }
  console.log(JSON.stringify({mode,status:'complete',completed,manifest_sha256:manifestHash,next:mode==='upload'?'Run 04-verify.sql and manually preview the eight PDFs':'Run 03-finish-cleanup.sql, then 04-verify.sql'},null,2));
 }catch(error){
  console.error(JSON.stringify({mode,status:'PARTIAL OR UNCERTAIN — STOP',completed,message:error.message,next:'Do not undo/delete unrelated state. Rerun only after inspection; identical bytes and lifecycle preflight are required. Never use upsert.'},null,2));process.exitCode=1;
 }
}
