/* No authenticated caching or fetch interception. Payload is always user-visible. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
 event.waitUntil((async()=>{
  let p;try{p=event.data.json();}catch{}
  const valid=p?.v===1&&/^[0-9a-f-]{36}$/i.test(p.id||'')&&typeof p.title==='string'&&typeof p.body==='string';
  const id=valid?p.id:null;
  await self.registration.showNotification(valid?Array.from(p.title).slice(0,110).join(''):'New TenOps notification',{
   body:valid?Array.from(p.body).slice(0,150).join(''):'Open TenOps to view your notifications.',
   tag:id?`tenops:${id}`:'tenops:notification',renotify:false,
   data:{url:id?`/?pushNotificationId=${encodeURIComponent(id)}`:'/'},icon:'/tenops-gold-app-icon-192.png',
  });
 })());
});
self.addEventListener('notificationclick', event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL(event.notification.data?.url||'/',self.location.origin);
  if(url.origin!==self.location.origin||url.pathname!=='/'||[...url.searchParams.keys()].some(k=>k!=='pushNotificationId'))return;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const client=windows.find(c=>new URL(c.url).origin===url.origin);
  if(client&&url.searchParams.get('pushNotificationId')){client.postMessage({type:'tenops:push-open',id:url.searchParams.get('pushNotificationId')});await client.focus();}else await self.clients.openWindow(url.href);
 })());
});
