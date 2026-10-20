// Pure, bounded transport policy; shared with focused local verifiers.
export function endpointAllowed(value){
 try{const u=new URL(value);return value.length<=2048&&u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash
  &&/^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9_./~-]+$/.test(value)
  &&(/^(?:[a-z0-9-]+\.)+push\.apple\.com$/.test(u.hostname)||['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(u.hostname));}catch{return false;}
}
export function clean(value,limit=140){
 const text=String(value??'').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&amp;/gi,'&').replace(/<[^>]*>?/g,'')
 .replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[`*_~#]/g,'').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim();
 const points=Array.from(text);return points.length>limit?points.slice(0,limit-1).join('')+'…':text;
}
export function payloadFor(row){
 const source=row.source,preview=row.previews===true;
 const title=preview?(source.kind==='dm'?`${clean(source.sender,50)||'TenOps'} · Direct Message`:`Mentioned by ${clean(source.sender,45)||'a colleague'} · ${clean(source.job,32)||'Job Update'}`):(source.kind==='dm'?'New TenOps message':'New TenOps mention');
 const body=preview?(source.attachment_only?'Sent an attachment':clean(source.text)||'Open TenOps to view this notification.'):'Open TenOps to view this notification.';
 return{v:1,id:row.notification_id,kind:source.kind,title,body,url:`/?pushNotificationId=${encodeURIComponent(row.notification_id)}`,tag:`tenops:${row.notification_id}`};
}
export function providerOutcome(status){if(status>=200&&status<300)return'accepted';if(status===404||status===410)return'invalid_subscription';if(status===429||status>=500||status===0)return'retryable';if(status===401||status===403)return'provider_auth';return'provider_rejected';}
export function retryDelay(attempt,retryAfter,now=Date.now(),random=Math.random){
 const numeric=Number(retryAfter),parsed=Date.parse(retryAfter);
 const requested=retryAfter?(Number.isFinite(numeric)?numeric:Math.max(0,(parsed-now)/1000)):0;
 return Math.max(1,Math.min(900,Math.ceil(Math.max(30*2**Math.max(0,attempt-1)*(0.8+random()*0.4),requested||0))));
}
export const wakeText=data=>`v1\n${data.environment}\n${data.run_id}\n${data.exp}`;
export async function verifyWake(data,key,environment,now=Date.now()){
 if(data?.v!==1||data.environment!==environment||!/^[a-z][a-z0-9_-]{0,31}$/.test(environment)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.run_id??'')||!Number.isSafeInteger(data.exp)||data.exp<now/1000||data.exp>now/1000+120||!/^[0-9a-f]{64}$/.test(data.sig??'')||!key||key.length<32)return false;
 const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',secret,Uint8Array.from(data.sig.match(/../g),x=>parseInt(x,16)),new TextEncoder().encode(wakeText(data)));
}
async function limitedBody(request){
 const reader=request.body?.getReader();if(!reader)return '';
 let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Request timeout')),2000);});
 try{return await Promise.race([(async()=>{let bytes=0,text='';const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>2048)throw new Error('Request too large');text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();})(),timeout]);}
 finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
export function createHandler({rpc,encrypt,submit,secret,environment,enabled=false,now=Date.now}){
 return async request=>{
  if(!enabled)return Response.json({status:'disabled'},{status:503});
  if(request.method!=='POST'||Number(request.headers.get('content-length')||0)>2048)return new Response(null,{status:400});
  let data;try{const body=await limitedBody(request);if(body.length>2048)return new Response(null,{status:400});data=JSON.parse(body);}catch{return new Response(null,{status:400});}
  if(!await verifyWake(data,secret,environment,now()))return new Response(null,{status:401});
  try{
   if(!await rpc('consume_web_push_run',{p_id:data.run_id,p_environment:environment,p_exp:data.exp}))return new Response(null,{status:409});
   const claims=await rpc('claim_web_push_deliveries',{p_environment:environment,p_limit:5});
   const counts={claimed:claims.length,submitted:0,skipped:0,failed:0};
   // Five claims and a 45-second processing deadline; unprocessed leases recover.
   const deadline=now()+45000;
   for(const claim of claims){
    if(now()>deadline)break;
    let outcome='unavailable',delay=30;
    try{
     const row=await rpc('prepare_web_push_delivery',{p_id:claim.id,p_lease:claim.lease_token});
     if(row){
      if(row.environment!==environment||!endpointAllowed(row.endpoint)){outcome='invalid_endpoint';}
      else{
       const payload=payloadFor(row);
       const ttl=Math.max(0,Math.min(3600,Math.floor((Date.parse(row.expires_at)-now())/1000)));
       if(ttl){
        const details=await encrypt(row,payload,ttl);
        // Recheck revocation/access/preference after encryption and before submission.
        const fresh=await rpc('prepare_web_push_delivery',{p_id:claim.id,p_lease:claim.lease_token});
        if(fresh&&fresh.endpoint===row.endpoint&&fresh.previews===row.previews&&JSON.stringify(fresh.source)===JSON.stringify(row.source)){
         const response=await submit(row.endpoint,details);outcome=providerOutcome(response.status);
         delay=retryDelay(row.attempts,response.headers.get('retry-after'),now());
        }
       }
      }
     }
    }catch(error){outcome=error?.name==='InvalidAccessError'||error?.name==='DataError'?'provider_rejected':'retryable';}
    await rpc('finish_web_push_delivery',{p_id:claim.id,p_lease:claim.lease_token,p_outcome:outcome,p_delay:delay});
    if(outcome==='accepted')counts.submitted++;else if(outcome==='unavailable')counts.skipped++;else counts.failed++;
   }
   await rpc('prune_web_push_transport');
   return Response.json(counts);
  }catch{return Response.json({status:'worker_failed'},{status:503});}
 };
}
