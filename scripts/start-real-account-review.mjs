/** Explicit local-only launcher. Production URL/key are read, never modified. */
import {createServer,request as httpRequest} from 'node:http';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PREFIX,CSP,planRequest,forwardHeaders,banner} from './support/read-only-review-guard.mjs';
const enabled=process.argv.includes('--read-only-review');
if(!enabled)throw Error('Explicit --read-only-review is mandatory. No unrestricted fallback.');
const envPath=process.env.TENOPS_REVIEW_ENV_FILE||'/Users/chrisngo/source/repos/tenarten-inventory-ui/.env.local';
const source=Object.fromEntries(readFileSync(envPath,'utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim().replace(/^(["'])(.*)\1$/,'$2')];}));
const target=new URL(source.NEXT_PUBLIC_SUPABASE_URL);
if(target.protocol!=='https:'||!target.hostname.endsWith('.supabase.co')||target.pathname!=='/'||!source.NEXT_PUBLIC_SUPABASE_ANON_KEY)throw Error('Expected existing hosted Supabase URL and public anon key.');
const appPort=3017,origin='http://localhost:3000';
const audit={blocked:0,auth:0,reads:0,businessMutationForwards:0};
const security={'content-security-policy':CSP,'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-tenops-review':'read-only'};
const server=createServer(async(req,res)=>{
 const deny=(status=403)=>{audit.blocked++;res.writeHead(status,{...security,'content-type':'application/json'});res.end(JSON.stringify({code:'LOCAL_READ_ONLY_REVIEW',message:'READ-ONLY REVIEW: this operation is disabled. Saving, sending and uploading are blocked.'}));};
 try{
  if(req.headers.host!=='localhost:3000'||(req.headers.origin&&req.headers.origin!==origin))return deny();
  const url=new URL(req.url,origin);
  if(url.pathname==='/__review_status'&&req.method==='GET'){res.writeHead(200,{...security,'content-type':'application/json'});res.end(JSON.stringify(audit));return;}
  if(url.pathname.startsWith(PREFIX+'/')){
   if(!['GET','HEAD','POST'].includes(req.method))return deny();
   let raw='';for await(const part of req){raw+=part;if(raw.length>65536)return deny(413);}
   let body={};if(raw){try{body=JSON.parse(raw);}catch{return deny(400);}}
   const plan=planRequest(req.url,req.method,body);if(!plan)return deny();
   const headers=forwardHeaders(req.headers,source.NEXT_PUBLIC_SUPABASE_ANON_KEY);
   if(plan.body)headers['content-type']='application/json';
   if(plan.kind==='auth')audit.auth++;else audit.reads++;
   const upstream=await fetch(new URL(plan.path,target),{method:plan.method,headers,body:plan.body?JSON.stringify(plan.body):undefined,redirect:'manual',signal:AbortSignal.timeout(20000)});
   if(upstream.status>=300&&upstream.status<400)return deny();
   const output={...security};for(const key of ['content-type','content-range','www-authenticate'])if(upstream.headers.has(key))output[key]=upstream.headers.get(key);
   res.writeHead(upstream.status,output);res.end(Buffer.from(await upstream.arrayBuffer()));return;
  }
  // Never forward local API routes/server actions, including GET mutation endpoints.
  if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/api/')||url.pathname.startsWith('/__'))return deny();
  const upstream=await fetch(`http://127.0.0.1:${appPort}${url.pathname}${url.search}`,{headers:Object.fromEntries(['accept','rsc','next-router-state-tree','next-router-prefetch','next-router-segment-prefetch','next-url'].filter(k=>req.headers[k]).map(k=>[k,req.headers[k]])),redirect:'manual',signal:AbortSignal.timeout(30000)});
  if(upstream.status>=300&&upstream.status<400){const loc=upstream.headers.get('location');if(!loc||!loc.startsWith('/')||loc.startsWith('//'))return deny();res.writeHead(upstream.status,{...security,location:loc});res.end();return;}
  const type=upstream.headers.get('content-type')||'application/octet-stream';
  let content=Buffer.from(await upstream.arrayBuffer());
  if(type.includes('text/html'))content=Buffer.from(content.toString().replace('</head>',banner+'</head>'));
  res.writeHead(upstream.status,{...security,'content-type':type});res.end(req.method==='HEAD'?undefined:content);
 }catch{if(!res.headersSent){res.writeHead(502,{...security,'content-type':'text/plain'});res.end('READ-ONLY REVIEW unavailable. Access remains blocked; no unrestricted fallback.');}else res.end();}
});
server.on('upgrade',(req,socket,head)=>{
 if(req.headers.host!=='localhost:3000'||req.headers.origin!==origin||new URL(req.url,origin).pathname!=='/_next/webpack-hmr'){socket.destroy();return;}
 const upstream=httpRequest({hostname:'127.0.0.1',port:appPort,path:req.url,headers:{...req.headers,host:`127.0.0.1:${appPort}`}});
 upstream.on('upgrade',(response,remote,remoteHead)=>{socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(response.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');if(head.length)remote.write(head);if(remoteHead.length)socket.write(remoteHead);remote.pipe(socket).pipe(remote);});upstream.on('error',()=>socket.destroy());upstream.end();
});
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:origin+PREFIX,NEXT_PUBLIC_SUPABASE_ANON_KEY:source.NEXT_PUBLIC_SUPABASE_ANON_KEY,NEXT_PUBLIC_RBAC_MODE:'enforced',RBAC_ENFORCED:'true',NEXT_PUBLIC_DEV_BRANDING:'false'};
delete env.SUPABASE_SERVICE_ROLE_KEY;delete env.SUPABASE_URL;
// Guard binds successfully before the application can initialize.
server.listen(3000,'localhost',()=>{
 const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'dev','--webpack','--hostname','127.0.0.1','--port',String(appPort)],{stdio:'inherit',env});
 const stop=()=>{child.kill('SIGTERM');server.close();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
 child.on('exit',code=>{server.close();process.exit(code??1);});
 console.log('READ-ONLY REVIEW: http://localhost:3000 — normal TenOps sign-in. No business-data writes forwarded.');
});
server.on('error',error=>{console.error('Review guard failed to bind:',error.message);process.exit(1);});
