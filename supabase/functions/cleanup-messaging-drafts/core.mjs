// Node-compatible Deno adapter. No caller supplies a bucket, path or message ID.
import {timingSafeEqual} from 'node:crypto';
const BUCKET='my-work-inbox-attachments';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function sameSecret(actual,expected){
  if(!expected||expected.length<32||!actual||actual.length>256)return false;
  const encode=new TextEncoder();
  const [a,b]=await Promise.all([actual,expected].map(x=>crypto.subtle.digest('SHA-256',encode.encode(x))));
  return timingSafeEqual(new Uint8Array(a),new Uint8Array(b));
}
export function boundedFetch(signal,fetcher=fetch){
  return (input,init={})=>fetcher(input,{...init,signal:AbortSignal.any([signal,AbortSignal.timeout(15000),...(init.signal?[init.signal]:[])])});
}
export function createHandler({secret,clientFactory,log=console.log,deadlineMs=100000}){
 return async request=>{
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
  if(!await sameSecret(request.headers.get('x-messaging-cleanup-secret'),secret))return new Response(null,{status:401});
  const supplied=request.headers.get('x-messaging-cleanup-run');
  if(supplied&&!UUID.test(supplied))return new Response(null,{status:400});
  const id=supplied||crypto.randomUUID(),controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),deadlineMs);
  const result={run_id:id,claimed:0,cleaned:0,failed:0,status:'failed',category:'setup'};
  let client;
  try{
   client=clientFactory(boundedFetch(controller.signal));
   const started=await client.from('messaging_cleanup_runs').upsert({id,status:'running',started_at:new Date().toISOString(),finished_at:null,claimed:0,cleaned:0,failed:0,category:null},{onConflict:'id'});
   if(started.error)throw Error('monitor');
   result.category='claim';
   const claim=await client.rpc('claim_abandoned_my_work_transfers',{p_limit:50});
   if(claim.error)throw Error('claim');
   if(!Array.isArray(claim.data)||claim.data.length>50)throw Error('claim-shape');
   result.claimed=claim.data.length;
   for(const draft of claim.data){
    try{
     if(controller.signal.aborted)throw Error('deadline');
     if(!UUID.test(draft.message_id)||!Array.isArray(draft.paths)||draft.paths.some(p=>typeof p!=='string'||p.split('/')[0]!==draft.message_id||p.includes('\0')))throw Error('scope');
     for(let i=0;i<draft.paths.length;i+=100){
      if(controller.signal.aborted)throw Error('deadline');
      const removed=await client.storage.from(BUCKET).remove(draft.paths.slice(i,i+100));
      if(removed.error)throw Error('storage');
     }
     if(controller.signal.aborted)throw Error('deadline');
     const finished=await client.rpc('finish_abandoned_my_work_transfer',{p_id:draft.message_id});
     if(finished.error)throw Error('finish');
     result.cleaned++;
    }catch{result.failed++;}
   }
   result.status=result.failed?'failed':'succeeded';result.category=controller.signal.aborted?'deadline':result.failed?'cleanup':null;
  }catch{result.status='failed';result.category=controller.signal.aborted?'deadline':result.category;}
  finally{clearTimeout(timer);}
  // Separate short timeout records failure even after the work budget expires.
  try{
   const monitor=clientFactory((input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(5000)}));
   const {run_id:recordId,...counts}=result;
   const recorded=await monitor.from('messaging_cleanup_runs').update({...counts,finished_at:new Date().toISOString()}).eq('id',recordId);
   if(recorded.error)throw Error('monitor');
  }catch{result.status='failed';result.category='monitor';}
  log(JSON.stringify(result));
  return Response.json(result,{status:result.status==='succeeded'?200:503,headers:{'Cache-Control':'no-store'}});
 };
}
