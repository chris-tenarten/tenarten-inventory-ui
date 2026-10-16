/** Trusted release tooling; default is read-only preview. Never imported by browser code. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
export const APPROVED_NAMES=['Anthony Iorio','Giovanni Coppola','Patrick Soldow','Chris Ngo'];
export const EXCLUDED_NAMES=['Marcos Alvarado','Jason Allen','chris developer'];
export const COMMUNICATION_KEY='sample_post_to_job_20261015';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function loadApprovedSpotlight(){
 const root=path.resolve('docs/project-memory/evidence/sample-post-spotlight'),content=JSON.parse(fs.readFileSync(root+'/announcement.json'));
 const evidence=JSON.parse(fs.readFileSync(root+'/validation.json'));
 assert.equal(content.communicationKey,COMMUNICATION_KEY);assert.equal(content.steps.length,5);
 const files=content.steps.map((step,index)=>{assert.equal(step.number,index+1);assert.equal(step.file,`0${index+1}.jpg`);const bytes=fs.readFileSync(root+'/'+step.file);const expected=evidence.screenshots.find(f=>f.file===step.file);assert.equal(hash(bytes),expected.sha256,'Approved screenshot changed');assert(bytes[0]===255&&bytes[1]===216&&bytes.length<=196608);return {bytes,name:`Step ${step.number} — ${step.caption}.jpg`,size:bytes.length,...content.dimensions[step.file],sha256:hash(bytes)};});
 const [title,...body]=content.body.split('\n\n');
 return {title,body:body.join('\n\n'),files,manifest:files.map(file=>({name:file.name,size:file.size,width:file.width,height:file.height,sha256:file.sha256}))};
}
export async function resolveSpotlightRecipients(client,expected=JSON.parse(fs.readFileSync('docs/project-memory/evidence/sample-post-spotlight/recipient-preview.json')).proposedRecipients){
 const {data,error}=await client.from('app_users').select('user_id,display_name,role,is_active').in('display_name',[...APPROVED_NAMES,...EXCLUDED_NAMES]);if(error)throw error;
 const recipients=[];
 for(const name of APPROVED_NAMES){const matches=data.filter(u=>u.display_name===name);assert.equal(matches.length,1,`Ambiguous or missing identity: ${name}`);const u=matches[0];assert.equal(u.user_id,expected.find(r=>r.name===name)?.userId,`Approved authenticated identity changed: ${name}`);assert.equal(u.is_active,true,`Inactive recipient: ${name}`);const authenticated=await client.auth.admin.getUserById(u.user_id);if(authenticated.error)throw authenticated.error;assert.equal(authenticated.data.user?.id,u.user_id,`Missing authenticated identity: ${name}`);assert(!authenticated.data.user.banned_until||Date.parse(authenticated.data.user.banned_until)<Date.now(),`Banned identity: ${name}`);recipients.push({userId:u.user_id,name,role:u.role,active:true,authenticatedIdentity:true,messagingEligible:true});}
 assert.equal(new Set(recipients.map(u=>u.userId)).size,4);assert(!data.filter(u=>EXCLUDED_NAMES.includes(u.display_name)).some(u=>recipients.some(r=>r.userId===u.user_id)));
 return recipients;
}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
/** Resumes hidden drafts; no overwrite, and ready recipients are never resent. */
export async function publishSpotlight(client,recipients,uploader,approved,{onProgress=()=>{}}={}){
 assert.deepEqual(recipients.map(r=>r.name),APPROVED_NAMES);
 const deliveries=await rpc(client,'prepare_tenops_rich_release_communication',{p_key:COMMUNICATION_KEY,p_title:approved.title,p_body:approved.body,p_recipients:recipients.map(r=>r.userId),p_files:approved.manifest,p_uploader:uploader});
 assert.equal(deliveries.length,4);assert.deepEqual(deliveries.map(d=>d.recipient),recipients.map(r=>r.userId));
 const result=[];
 for(const delivery of deliveries){
  if(delivery.status==='ready'){result.push({recipient:delivery.recipient,status:'already-delivered'});continue;}
  assert.equal(delivery.status,'draft');assert.equal(delivery.files.length,5);
  const bucket=client.storage.from('my-work-inbox-attachments');
  for(let i=0;i<5;i++){
   const reserved=delivery.files[i],file=approved.files[i];assert.equal(reserved.name,file.name);assert.equal(Number(reserved.size),file.size);
   for(const objectPath of [reserved.path,reserved.previewPath]){
    const read=await bucket.download(objectPath);
    if(read.error){
     // Only absence permits upload. Network/auth failures stop without replacing anything.
     const status=String(read.error.statusCode??read.error.status??'');
     if(!['404','400'].includes(status)||!/(not found|does not exist|not_found)/i.test(read.error.message))throw read.error;
     const upload=await bucket.upload(objectPath,file.bytes,{contentType:'application/octet-stream',upsert:false});
     if(upload.error&&!['409'].includes(String(upload.error.statusCode??upload.error.status??''))&&!/already exists/i.test(upload.error.message))throw upload.error;
    }
    const downloaded=await bucket.download(objectPath);if(downloaded.error)throw downloaded.error;
    const bytes=Buffer.from(await downloaded.data.arrayBuffer());assert.equal(bytes.length,file.size);assert.equal(hash(bytes),file.sha256,'Stored screenshot differs; refusing publication');
   }
  }
  const delivered=await rpc(client,'complete_tenops_rich_release_message',{p_key:COMMUNICATION_KEY,p_recipient:delivery.recipient,p_verified_sha256:approved.files.map(f=>f.sha256)});
  result.push({recipient:delivery.recipient,status:delivered?'delivered':'already-delivered'});onProgress(result.at(-1));
 }
 return result;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL??process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;assert(url&&key,'Server URL and service-role credential required; do not put these in browser code.');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const approved=loadApprovedSpotlight();const recipients=await resolveSpotlightRecipients(client);
 if(!process.argv.includes('--deliver'))console.log(JSON.stringify({mode:'READ_ONLY_PREVIEW',communicationKey:COMMUNICATION_KEY,recipients,excluded:EXCLUDED_NAMES,files:approved.manifest},null,2));
 else{
  assert.equal(process.env.TENOPS_RELEASE_DELIVERY_CONFIRM,'DELIVER_APPROVED_SAMPLE_POST_SPOTLIGHT','Delivery requires separate explicit Product authorization.');
  assert(['http://127.0.0.1:','http://localhost:'].some(prefix=>url.startsWith(prefix))||url==='https://vxdxjhazkqhpkwdqtobp.supabase.co','Unexpected project');
  const uploader=recipients.find(r=>r.name==='Chris Ngo');assert.equal(uploader.role,'admin');
  console.log(JSON.stringify(await publishSpotlight(client,recipients,uploader.userId,approved,{onProgress:item=>console.log(JSON.stringify(item))}),null,2));
 }
}
