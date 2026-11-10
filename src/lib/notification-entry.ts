const KEY='tenops.push.pending-entry.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function pendingNotificationId(): string | null {
 if(typeof window==='undefined')return null;
 const query=new URLSearchParams(window.location.search).get('pushNotificationId');
 try{return query&&UUID.test(query)?query:(sessionStorage.getItem(KEY)&&UUID.test(sessionStorage.getItem(KEY)!)?sessionStorage.getItem(KEY):null);}catch{return query&&UUID.test(query)?query:null;}
}
export function rememberNotification(id:string){if(UUID.test(id))sessionStorage.setItem(KEY,id);}
export function clearNotification(){sessionStorage.removeItem(KEY);const u=new URL(window.location.href);u.searchParams.delete('pushNotificationId');window.history.replaceState({},'',u.pathname+u.search+u.hash);}
