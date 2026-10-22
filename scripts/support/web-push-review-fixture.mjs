// Local-only synthetic subscription adapter; never imported by application source.
// Browser vendor APIs are simulated. The actual /sw.js still registers normally.
import {createHash} from 'node:crypto';
import {payloadFor} from '../../supabase/functions/send-web-push/core.mjs';
const events=new Map();
const rows=new Map();
export const reviewNotificationHistory=actor=>[...events.values()].filter(e=>e.user_id===actor);
export function reviewPushEvent(kind,actor,jobId,peerId,deviceId){
 const id=crypto.randomUUID();const source=kind==='mention'?{kind:'mention',sender:'Blair Lead',job:'26-1042',text:'Please verify material readiness before production.'}:{kind:'dm',sender:'Alex Operator',text:'Can you check the revised color plate before tomorrow?'};
 const device=rows.get(deviceId);const previews=device?.owner===actor&&device.enabled?device.previews!==false:false;
 const event={id,user_id:actor,notification_type:kind==='mention'?'job_update_mention':'inbox_message',title:source.sender,body:source.text,created_at:new Date().toISOString(),read_at:null,metadata:kind==='mention'?{job_id:jobId,update_id:id,job_name:'Disposable Job — Sample review'}:{conversation_user_id:peerId,message_id:id}};
 events.set(id,event);return {...payloadFor({notification_id:id,source,previews}),event};
}
let index=0;
export async function pushReviewRpc(name,body,actor,control){
 if(control.pushDelay&&name==='register_my_web_push_subscription')await new Promise(r=>setTimeout(r,control.pushDelay));
 if(control.pushFailure)return{status:503,data:{message:'Simulated offline registration failure'}};
 if(name==='resolve_my_push_notification'){const e=events.get(body.p_id);return{status:200,data:e?.user_id===actor?(e.notification_type==='inbox_message'?{kind:'dm',conversation_user_id:e.metadata.conversation_user_id}:{kind:'mention',job_id:e.metadata.job_id,update_id:e.metadata.update_id}):null};}
 if(name==='can_view_my_web_push_settings')return{status:200,data:true};
 if(name==='get_my_web_push_configuration')return{status:200,data:control.pushUnconfigured?null:{environment:'local-review',public_key:'BA'+'A'.repeat(85),key_version:'review-only'}};
 if(name==='register_my_web_push_subscription'){
  const endpoint=body.p_subscription?.endpoint;
  let row=[...rows.values()].find(r=>r.endpoint===endpoint);
  if(row&&row.owner!==actor)return{status:403,data:{message:'Subscription unavailable'}};
  row??={id:body.p_id||`00000000-0000-4000-8000-${String(++index).padStart(12,'0')}`,generation:1,owner:actor,enabled:true,previews:true,endpoint};rows.set(row.id,row);
  return{status:200,data:{id:row.id,generation:row.generation}};
 }
 const row=rows.get(body.p_id);
 if(name==='get_my_web_push_subscription')return{status:200,data:row?.owner===actor?{enabled:row.enabled,generation:row.generation,show_previews:row.previews,delivery_enabled:true,endpoint_hash:createHash('sha256').update(row.endpoint).digest('hex'),environment:'local-review',key_version:'review-only'}:null};
 if(name==='set_my_web_push_previews'){if(row?.owner===actor&&row.enabled&&row.generation===body.p_generation){row.previews=body.p_enabled;return{status:200,data:true};}return{status:200,data:false};}
 if(name==='revoke_my_web_push_subscription'){
  if(row?.owner===actor&&row.generation===body.p_generation&&row.enabled){row.enabled=false;row.generation++;}return{status:200,data:!(row?.owner===actor&&row.enabled)};
 }
 return{status:404,data:null};
}
export const pushReviewScript=String.raw`
window.__pushReview={permission:localStorage.getItem('review.push.permission')||'default',requests:0,subscriptions:0,unsubscribes:0,failUnsubscribe:false};
const review=window.__pushReview;
Object.defineProperty(Notification,'permission',{get:()=>review.permission,configurable:true});
Notification.requestPermission=()=>{review.requests++;review.permission=localStorage.getItem('review.push.answer')||'granted';localStorage.setItem('review.push.permission',review.permission);return Promise.resolve(review.permission);};
function subscription(){const endpoint=localStorage.getItem('review.push.endpoint');if(!endpoint)return null;return {endpoint,expirationTime:review.expired?Date.now()-1000:null,toJSON:()=>({endpoint,expirationTime:null,keys:{p256dh:'BA'+'A'.repeat(85),auth:'A'.repeat(22)}}),unsubscribe:async()=>{review.unsubscribes++;if(review.failUnsubscribe)throw new Error('Simulated unsubscribe failure');localStorage.removeItem('review.push.endpoint');return true;}};}
PushManager.prototype.getSubscription=async()=>subscription();
PushManager.prototype.subscribe=async()=>{review.subscriptions++;localStorage.setItem('review.push.endpoint','https://web.push.apple.com/local-review-'+crypto.randomUUID());return subscription();};
window.addEventListener('DOMContentLoaded',()=>{const note=document.createElement('div');note.id='push-review-notice';note.textContent='LOCAL REVIEW · Simulated permission and subscription · No device notifications';note.style='position:fixed;bottom:0;left:0;right:0;z-index:200;background:#fef3c7;padding:6px;text-align:center;font:12px system-ui;color:#78350f';document.body.append(note);});
`;

export const pushDemoScript=String.raw`
window.addEventListener('DOMContentLoaded',()=>{
 const panel=document.createElement('details');panel.id='push-demo-controls';panel.style='position:fixed;bottom:30px;right:12px;z-index:210;background:white;color:#172033;border:1px solid #8aa0ba;padding:10px;max-width:340px;font:13px system-ui';
 const summary=document.createElement('summary');summary.textContent='Simulated push review';panel.append(summary);
 const banner=document.createElement('button');banner.type='button';banner.style='display:none;text-align:left;white-space:normal;border:1px solid #64748b;background:#eff6ff;padding:12px;margin-top:8px;width:100%';banner.setAttribute('data-simulated-banner','true');
 for(const [label,kind] of [['Simulate Direct Message','dm'],['Simulate Job mention','mention']]){
  const button=document.createElement('button');button.textContent=label;button.style='display:block;margin:8px;padding:8px';button.onclick=async()=>{
   const token=JSON.parse(localStorage.getItem('sb-localhost-auth-token')||'null')?.access_token;
   const p=await(await fetch('/__review/push-event?kind='+kind+'&device='+encodeURIComponent(JSON.parse(localStorage.getItem('tenops.push.device.v1')||'null')?.id||''),{headers:{Authorization:'Bearer '+token}})).json();
   banner.textContent=p.title+' — '+p.body;banner.style.display='block';banner.dataset.notificationId=p.id;window.lastPushPreview=p;
   banner.onclick=()=>{navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{origin:location.origin,data:{type:'tenops:push-open',id:p.id}}));};
   window.dispatchEvent(new Event('tenops:notifications-changed'));
  };panel.append(button);
 }
 const normal=document.createElement('button');normal.textContent='Normal fresh launch';normal.onclick=()=>{const s=JSON.parse(localStorage.getItem('sb-localhost-auth-token'));sessionStorage.removeItem('tenops.welcomeHeroPlayed:'+s.user.id);sessionStorage.removeItem('tenops.push.pending-entry.v1');location.href='/';};panel.append(normal,banner);document.body.append(panel);
});`;
