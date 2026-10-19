import assert from 'node:assert/strict';
import { CoalescedRead, InvalidatedRead } from '../src/lib/coalesced-read';
const checks:string[]=[];
function deferred<T>() {let resolve!:(v:T)=>void;let reject!:(e:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
{
 let calls=0;const read=new CoalescedRead(async()=>++calls,2000);
 const results=await Promise.all(Array.from({length:10},()=>read.refresh()));
 assert.deepEqual(results,Array(10).fill(1));assert.equal(calls,1);
 assert.equal(await read.read(),1);assert.equal(await read.refresh(),2);
 checks.push('same-turn events share one request; reuse never suppresses subsequent meaningful refresh');
}
{
 const reads:ReturnType<typeof deferred<string>>[]=[];const values:string[]=[];
 const read=new CoalescedRead(()=>{const d=deferred<string>();reads.push(d);return d.promise;},2000);read.subscribe(v=>values.push(v));
 const first=read.read();await tick();const second=read.refresh();const third=read.refresh();reads[0].resolve('stale');await tick();
 assert.equal(reads.length,2);assert.deepEqual(values,[]);reads[1].resolve('new');assert.deepEqual(await Promise.all([first,second,third]),['new','new','new']);assert.deepEqual(values,['new']);
 checks.push('events during a pending read queue one trailing read; obsolete snapshots never publish');
}
{
 const a=deferred<string>(),b=deferred<string>();let calls=0;const values:string[]=[];
 const read=new CoalescedRead(()=>++calls===1?a.promise:b.promise,2000);read.subscribe(v=>values.push(v));
 const old=read.read();const rejected=assert.rejects(old,InvalidatedRead);await tick();read.reset();const next=read.read();await tick();b.resolve('account B');assert.equal(await next,'account B');a.resolve('account A');await rejected;assert.deepEqual(values,['account B']);
 checks.push('reset rejects delayed prior owner after newer owner completes; no cross-owner publication');
}
{
 const a=deferred<string>();const read=new CoalescedRead(()=>a.promise);const old=read.read();const rejected=assert.rejects(old,InvalidatedRead);await tick();read.reset();a.reject(new Error('old denial'));await rejected;
 checks.push('late errors after cleanup are invalidated, including StrictMode cleanup generation');
}
{
 let calls=0;const read=new CoalescedRead(async()=>{if(++calls===1)throw new Error('403 denied');return 'recovered';},2000);
 await assert.rejects(read.read(),/403 denied/);assert.equal(await read.read(),'recovered');
 const original=Date.now;let now=0;Date.now=()=>now;
 try{const finite=new CoalescedRead(async()=>++calls,2000);const one=await finite.read();assert.equal(await finite.read(),one);now=2001;assert.notEqual(await finite.read(),one);}finally{Date.now=original;}
 checks.push('denial is not cached; errors retry; reuse expires');
}
{
 const a=deferred<number>();let calls=0;const read=new CoalescedRead(()=>++calls===1?a.promise:Promise.resolve(2));
 const pending=read.read();await tick();read.invalidate();a.reject(new Error('obsolete failed snapshot'));assert.equal(await pending,2);
 checks.push('a meaningful event during failure still gets its trailing read');
}
console.log(JSON.stringify({passed:checks.length,checks},null,2));
