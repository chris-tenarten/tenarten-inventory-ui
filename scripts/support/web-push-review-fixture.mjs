// Local-only synthetic subscription adapter; never imported by application source.
// Browser vendor APIs are simulated. The actual /sw.js still registers normally.
const rows=new Map();
let index=0;
export async function pushReviewRpc(name,body,actor,control){
 if(control.pushDelay&&name==='register_my_web_push_subscription')await new Promise(r=>setTimeout(r,control.pushDelay));
 if(control.pushFailure)return{status:503,data:{message:'Simulated offline registration failure'}};
 if(name==='get_my_web_push_configuration')return{status:200,data:control.pushUnconfigured?null:{environment:'local-review',public_key:'BA'+'A'.repeat(85),key_version:'review-only'}};
 if(name==='register_my_web_push_subscription'){
  const endpoint=body.p_subscription?.endpoint;
  let row=[...rows.values()].find(r=>r.endpoint===endpoint);
  if(row&&row.owner!==actor)return{status:403,data:{message:'Subscription unavailable'}};
  row??={id:body.p_id||`00000000-0000-4000-8000-${String(++index).padStart(12,'0')}`,generation:1,owner:actor,enabled:true,endpoint};rows.set(row.id,row);
  return{status:200,data:{id:row.id,generation:row.generation}};
 }
 const row=rows.get(body.p_id);
 if(name==='get_my_web_push_subscription')return{status:200,data:row?.owner===actor?{enabled:row.enabled,generation:row.generation}:null};
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
