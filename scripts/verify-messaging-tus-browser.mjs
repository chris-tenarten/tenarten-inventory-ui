/** Real browser + actual tus-js-client against disposable local protocol fixture.
 * Streams 2 x 250 MB in 6 MiB chunks; never contacts Supabase. Not a hosted Storage test.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
const dir='.tmp-messaging';await mkdir(dir,{recursive:true});
await build({stdin:{contents:"import * as transfer from './src/modules/my-work/messaging/transfer'; window.messaging=transfer;",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',outfile:`${dir}/transfer.js`});
const script=await readFile(`${dir}/transfer.js`);
let next=0,patches=0,heads=0,maxChunk=0,failOnce=true,downloaded=0;
const uploads=new Map();
const server=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','POST,PATCH,HEAD,OPTIONS,GET');res.setHeader('Access-Control-Expose-Headers','Location,Upload-Offset,Upload-Length,Tus-Resumable');res.setHeader('Tus-Resumable','1.0.0');
 const path=new URL(req.url,'http://localhost').pathname;
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Disposable Messaging transfer verifier</title><script src="/transfer.js"></script>');return;}
 if(path==='/transfer.js'){res.setHeader('Content-Type','text/javascript');res.end(script);return;}
 if(path==='/download'){
  res.setHeader('Content-Type','application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''drawing%20%26%20%23.dwg");
  res.setHeader('Content-Length','250000000');let sent=0;const chunk=Buffer.alloc(64*1024);
  const pump=()=>{while(sent<250000000){const part=chunk.subarray(0,Math.min(chunk.length,250000000-sent));sent+=part.length;downloaded+=part.length;if(!res.write(part)){res.once('drain',pump);return;}}res.end();};pump();return;
 }
 if(req.headers.authorization!=='Bearer local-test-token'){res.writeHead(401).end();return;}
 if(req.method==='POST'){
  const id=String(++next);const size=Number(req.headers['upload-length']);assert(size<=250000000);
  assert(String(req.headers['upload-metadata']).includes(Buffer.from('application/octet-stream').toString('base64')));
  uploads.set(id,{size,offset:0});res.setHeader('Location',`/uploads/${id}`);res.writeHead(201).end();return;
 }
 const item=uploads.get(path.split('/').at(-1));if(!item){res.writeHead(404).end();return;}
 if(req.method==='HEAD'){heads++;res.setHeader('Upload-Offset',item.offset);res.setHeader('Upload-Length',item.size);res.writeHead(200).end();return;}
 if(req.method==='PATCH'){
  patches++;assert.equal(Number(req.headers['upload-offset']),item.offset);let bytes=0;for await(const chunk of req){bytes+=chunk.length;assert(chunk.every(value=>value===0),'fixture bytes changed');}
  maxChunk=Math.max(maxChunk,bytes);assert(bytes<=6*1024*1024);
  if(failOnce){failOnce=false;res.writeHead(503).end();return;}
  item.offset+=bytes;assert(item.offset<=item.size);res.setHeader('Upload-Offset',item.offset);res.writeHead(204).end();return;
 }
 res.writeHead(405).end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({acceptDownloads:true});await page.goto(base);
 const result=await page.evaluate(async(base)=>{
  const part=new Uint8Array(1_000_000);const files=[new File(Array(250).fill(part),'drawing.dwg'),new File(Array(250).fill(part),'installer.exe')];
  let progress=0,retries=0;
  for(let i=0;i<files.length;i++)await window.messaging.uploadResumable({baseUrl:base,id:crypto.randomUUID(),entry:{id:crypto.randomUUID(),name:files[i].name,size:files[i].size,contentType:'application/octet-stream'},file:files[i],signal:new AbortController().signal,credentials:async()=>({token:'local-test-token',key:'local'}),progress:(bytes,retry)=>{progress=Math.max(progress,bytes);if(retry)retries++;}});
  return{progress,retries};
 },base);
 assert.equal(result.progress,250000000);assert(result.retries>0);assert(heads>0);assert.equal([...uploads.values()].reduce((sum,item)=>sum+item.offset,0),500000000);
 const downloadEvent=page.waitForEvent('download');await page.evaluate(base=>{const a=document.createElement('a');a.href=base+'/download';document.body.append(a);a.click();},base);
 const download=await downloadEvent;assert.equal(download.suggestedFilename(),'drawing & #.dwg');await download.saveAs(`${dir}/download.dwg`);assert.equal(downloaded,250000000);
 // Abort actual TUS while it is sending, then explicitly retry against the same object identity.
 const canceled=await page.evaluate(async(base)=>{
  const controller=new AbortController();let stopped=false;
  try{await window.messaging.uploadResumable({baseUrl:base,id:crypto.randomUUID(),entry:{id:crypto.randomUUID(),name:'cancel.zip',size:250000000,contentType:'application/octet-stream'},file:new File(Array(250).fill(new Uint8Array(1000000)),'cancel.zip'),signal:controller.signal,credentials:async()=>({token:'local-test-token',key:'local'}),progress:(bytes)=>{if(bytes>0)controller.abort();}});}catch{stopped=true;}
  return stopped;
 },base);assert(canceled);
 await writeFile(`${dir}/tus-results.json`,JSON.stringify({bytesUploaded:500000000,bytesDownloaded:downloaded,maxChunk,patches,heads,retryEvents:result.retries,canceled,scope:'Real Chromium + actual TUS client; local protocol fixture, not Supabase Storage'},null,2));
 console.log('PASS: browser TUS 2 x 250 MB, bounded chunks, 503 retry/HEAD resume, progress, active abort, streamed 250 MB native download.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
