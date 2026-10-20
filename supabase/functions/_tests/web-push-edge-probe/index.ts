import webpush from 'npm:web-push@3.6.7';
Deno.serve(async () => {
 try {
  const pair=webpush.generateVAPIDKeys();
  const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const encode=(data:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(data))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const plain='Synthetic informative preview';
  const details=webpush.generateRequestDetails({endpoint:'https://web.push.apple.com/never-contacted',keys:{p256dh:encode(await crypto.subtle.exportKey('raw',ua.publicKey)),auth:encode(crypto.getRandomValues(new Uint8Array(16)))}},plain,{TTL:3600,vapidDetails:{subject:'mailto:operator@example.invalid',publicKey:pair.publicKey,privateKey:pair.privateKey}});
  return Response.json({ok:true,runtime:Deno.version,contentEncoding:details.headers['Content-Encoding'],encryptedBytes:details.body.length,containsPlaintext:new TextDecoder().decode(details.body).includes(plain),vapid:details.headers.Authorization?.startsWith('vapid '),networkPushRequests:0});
 }catch(error){return Response.json({ok:false,error:String(error)},{status:500});}
});
