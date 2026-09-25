/** Exercises the actual composer queue hook in Chromium. Real clipboard text paste,
 * exposed clipboard File items, drag/drop and keyboard picker accessibility.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
const dir='.tmp-messaging';await mkdir(dir,{recursive:true});
const source=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useAttachmentQueue} from './src/modules/my-work/messaging/useAttachmentQueue';
function App(){const[error,setError]=useState('');const[body,setBody]=useState('');const q=useAttachmentQueue(false,setError);return <main><section {...q.events} data-composer data-dragging={q.dragging}><textarea aria-label="Message" value={body} onChange={e=>setBody(e.target.value)}/><input aria-label="Attach files" type="file" multiple onChange={e=>{q.add(Array.from(e.target.files||[]),'picker',e.nativeEvent);e.target.value='';}}/><button onClick={q.clear}>Clear</button><output role="alert">{error}</output><ul>{q.files.map((f,i)=><li key={i}>{f.name} | {f.size}</li>)}</ul><pre data-body>{body}</pre></section><aside data-outside>Outside composer</aside></main>};createRoot(document.getElementById('root')).render(<App/>);`;
await build({stdin:{contents:source,loader:'tsx',resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},outfile:`${dir}/composer.js`});
const script=await readFile(`${dir}/composer.js`);const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?script:'<!doctype html><div id="root"></div><script src="/app.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();let requests=0;page.on('request',()=>requests++);await page.goto(base);const text=page.getByRole('textbox',{name:'Message'});await text.fill('Existing ');
 await page.evaluate(()=>navigator.clipboard.writeText('ordinary text'));await text.focus();await page.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');await page.waitForFunction(()=>document.querySelector('textarea').value==='Existing ordinary text');assert.equal(await page.locator('li').count(),0);
 // Actual browser clipboard screenshot, with native paste event.
 await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;const blob=await new Promise(r=>canvas.toBlob(r));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);});
 await text.focus();await page.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');await page.waitForFunction(()=>document.querySelectorAll('li').length===1);assert.match(await page.locator('li').first().innerText(),/Screenshot .*\.png/);assert.equal(await text.inputValue(),'Existing ordinary text');
 const baselineRequests=requests;
 await page.getByLabel('Attach files').setInputFiles({name:'picker.dwg',mimeType:'application/octet-stream',buffer:Buffer.from('drawing')});
 const pasted=await text.evaluate(el=>{const d=new DataTransfer();d.items.add(new File(['zip'],'archive.zip'));d.items.add(new File(['x'],'image.png',{type:'image/png'}));d.setData('text/plain','Mixed text');const e=new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true});el.dispatchEvent(e);return{prevented:e.defaultPrevented,text:el.value};});
 assert.equal(pasted.prevented,false);assert.equal(pasted.text,'Existing ordinary text'); // native insertion is browser-owned, not synthesized by hook
 await page.waitForFunction(()=>document.querySelectorAll('li').length===4);
 const drag=await page.locator('[data-composer]').evaluate(el=>{const d=new DataTransfer();d.items.add(new File(['a'],'drop1.exe'));d.items.add(new File(['b'],'drop2.dxf'));const enter=new DragEvent('dragenter',{dataTransfer:d,bubbles:true,cancelable:true});el.dispatchEvent(enter);return enter.defaultPrevented;});assert(drag);
 await page.waitForFunction(()=>document.querySelector('[data-composer]').dataset.dragging==='true');
 await page.locator('[data-composer]').evaluate(el=>{const d=new DataTransfer();d.items.add(new File(['a'],'drop1.exe'));d.items.add(new File(['b'],'drop2.dxf'));const e=new DragEvent('drop',{dataTransfer:d,bubbles:true,cancelable:true});el.dispatchEvent(e);if(!e.defaultPrevented)throw Error('Drop not prevented');});
 await page.waitForFunction(()=>document.querySelectorAll('li').length===6&&document.querySelector('[data-composer]').dataset.dragging==='false');
 await page.locator('[data-composer]').evaluate(el=>{const d=new DataTransfer();d.items.add(new File(['a'],'x'));el.dispatchEvent(new DragEvent('dragenter',{dataTransfer:d,bubbles:true,cancelable:true}));});await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('[data-composer]').dataset.dragging==='false');
 // Both collections expose identical items but exactly one queue addition per event.
 await text.evaluate(el=>{const d=new DataTransfer();d.items.add(new File(['a'],'once.txt'));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));});await page.waitForFunction(()=>document.querySelectorAll('li').length===7);
 const unsupported=await text.evaluate(el=>{const d={items:[{kind:'file',getAsFile:()=>null}],files:[],getData:()=>''};const e=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:d});el.dispatchEvent(e);return e.defaultPrevented;});assert.equal(unsupported,false);assert.match(await page.getByRole('alert').innerText(),/Use Attach or drag and drop/);
 await text.focus();await page.keyboard.press('Tab');assert.equal(await page.getByLabel('Attach files').evaluate(el=>el===document.activeElement),true);
 assert.equal(requests,baselineRequests,'queue additions must not start uploads');assert(!await page.locator('[data-body]').innerText().then(x=>x.includes('base64')));
 const outside=await page.locator('[data-outside]').evaluate(el=>{const d=new DataTransfer();d.items.add(new File(['x'],'outside.bin'));const e=new DragEvent('drop',{dataTransfer:d,bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;});assert.equal(outside,false);
 await page.screenshot({path:`${dir}/composer-queue.png`});
 await writeFile(`${dir}/composer-results.json`,JSON.stringify({textPaste:true,nativeScreenshotPaste:true,multipleFiles:true,mixedTextNotPrevented:true,pickerPasteDropCount:7,dropPrevented:true,dragReset:true,keyboardPicker:true,noQueueNetwork:true,unsupportedFallback:true},null,2));
 console.log('PASS: native text/screenshot paste; clipboard naming; multiple/mixed files; picker + paste + drop; scoped drop prevention; drag cleanup; keyboard picker; unsupported clipboard fallback; no queue network/Base64.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
