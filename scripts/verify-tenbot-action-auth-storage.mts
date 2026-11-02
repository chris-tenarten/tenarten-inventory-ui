/** Focused compare-and-set storage integration with the installed Supabase SDK.
 * All Auth HTTP responses are local doubles. No network, password verification,
 * provider calls or business persistence occurs. */
import assert from 'node:assert/strict';
import {createClient,type Session,type User} from '@supabase/supabase-js';
import {createActionSessionStorage,type ActionSessionSnapshot} from '../src/lib/auth-action-session';

const owner='00000000-0000-4000-8000-000000000010',other='00000000-0000-4000-8000-000000000011';
const originalLogin='00000000-0000-4000-8000-000000000020',freshLogin='00000000-0000-4000-8000-000000000021',otherLogin='00000000-0000-4000-8000-000000000022';
const checks:string[]=[];
let sdkRefreshDeferredRejections=0;
let number=0;
const token=(id=owner,login=originalLogin,expiresAt=Math.floor(Date.now()/1000)+3600)=>[
 Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
 Buffer.from(JSON.stringify({sub:id,role:'authenticated',session_id:login,aal:'aal1',exp:expiresAt})).toString('base64url'),
 Buffer.from('synthetic-signature').toString('base64url'),
].join('.');
const user=(id=owner):User=>({id,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-11-02T00:00:00Z'});
const originalToken=token(),freshToken=token(owner,freshLogin),otherToken=token(other,otherLogin);
const snapshot:ActionSessionSnapshot={ownerId:owner,accessToken:originalToken,contextKey:'verified-profile-generation-1'};
const session=(accessToken:string,id=owner):Session=>({access_token:accessToken,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:user(id)});
function backing(){
 const values=new Map<string,string>();
 return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
}
function pure(){
 const store=backing(),key='synthetic-auth-token';store.setItem(key,JSON.stringify(session(originalToken)));
 const wrapped=createActionSessionStorage(store);
 let current:ActionSessionSnapshot|null={...snapshot};
 return {store,key,wrapped,current:()=>current,setCurrent(value:ActionSessionSnapshot|null){current=value;}};
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
async function sdk(options:{deferUser?:boolean;deferRefresh?:boolean;refreshRejected?:boolean}={}){
 const store=backing(),storageKey='tenbot-auth-storage-fixture-'+(++number),wrapped=createActionSessionStorage(store);
 store.setItem(storageKey,JSON.stringify(session(originalToken)));
 let current:ActionSessionSnapshot|null={...snapshot};
 const entered=deferred<void>(),release=deferred<void>(),events:string[]=[],calls:string[]=[];
 const client=createClient('https://synthetic-auth.invalid','synthetic-anon-key',{
  auth:{storageKey,storage:wrapped.storage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:async(input)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);calls.push(url.pathname+(url.search||''));
   assert.equal(url.origin,'https://synthetic-auth.invalid');
   if(url.pathname==='/auth/v1/user'){
    entered.resolve();if(options.deferUser)await release.promise;
    return Response.json(user());
   }
   if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='password')return Response.json(session(otherToken,other));
   if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='refresh_token'){
    entered.resolve();if(options.deferRefresh)await release.promise;
    if(options.refreshRejected)return Response.json({message:'Synthetic refresh token no longer valid',error_code:'refresh_token_not_found'},{status:401});
    return Response.json(session(token(owner,freshLogin,Math.floor(Date.now()/1000)+3700)));
   }
   throw Error('Unexpected mocked Auth request');
  }},
 });
 await client.auth.initialize();
 const {data:{subscription}}=client.auth.onAuthStateChange((event)=>{events.push(event);});
 return {client,store,storageKey,wrapped,events,calls,entered,release,current:()=>current,setCurrent(value:ActionSessionSnapshot|null){current=value;},close(){subscription.unsubscribe();client.auth.stopAutoRefresh();}};
}

{
 const f=pure(),storage=f.wrapped.storage!;
 storage.setItem('unrelated-key','plain SDK value');assert.equal(storage.getItem('unrelated-key'),'plain SDK value');storage.removeItem('unrelated-key');assert.equal(storage.getItem('unrelated-key'),null);
 const guard=f.wrapped.guard(freshToken,snapshot,f.current),different=JSON.stringify(session(otherToken,other));
 storage.setItem('code-verifier','synthetic-code');storage.removeItem('code-verifier');assert.equal(storage.getItem('code-verifier'),null);
 assert.throws(()=>storage.removeItem(f.key));
 const finishSignOut=f.wrapped.allowSignOut(originalToken);storage.removeItem(f.key);assert.equal(f.store.getItem(f.key),null);
 storage.setItem(f.key,different);assert.throws(()=>storage.removeItem(f.key));assert.equal(f.store.getItem(f.key),different);
 finishSignOut();storage.setItem(f.key,JSON.stringify(session(originalToken)));assert.throws(()=>storage.removeItem(f.key));
 storage.setItem(f.key,different);assert.equal(f.store.getItem(f.key),different);assert.equal(guard.saved(),false);guard.release();
 storage.removeItem(f.key);assert.equal(storage.getItem(f.key),null);
 checks.push('Ordinary SDK storage remains transparent; pending handoff blocks session deletion except explicit sign-out for its exact token, while other tokens and released permits remain protected');
}
{
 const f=pure(),guard=f.wrapped.guard(freshToken,snapshot,f.current),next=JSON.stringify(session(freshToken));
 assert.throws(()=>f.wrapped.guard(freshToken,snapshot,f.current));
 f.wrapped.storage!.setItem(f.key,next);assert.equal(f.store.getItem(f.key),next);assert.equal(guard.saved(),true);
 assert.throws(()=>f.wrapped.storage!.setItem(f.key,next));assert.equal(f.store.getItem(f.key),next);
 guard.release();f.wrapped.storage!.setItem(f.key,JSON.stringify(session(otherToken,other)));assert.equal(JSON.parse(f.store.getItem(f.key)!).user.id,other);
 assert.throws(()=>createActionSessionStorage().guard(freshToken,snapshot,()=>snapshot));
 assert.throws(()=>f.wrapped.guard('',snapshot,f.current));
 checks.push('An exact handoff saves once, rejects overlapping/replayed guards and releases without adding another session store');
}
{
 const changed=[null,{...snapshot,ownerId:other},{...snapshot,accessToken:otherToken},{...snapshot,contextKey:'changed-access'}];
 for(const next of changed){
  const f=pure();f.setCurrent(next);assert.throws(()=>f.wrapped.guard(freshToken,snapshot,f.current));
  f.setCurrent({...snapshot});const guard=f.wrapped.guard(freshToken,snapshot,f.current),before=f.store.getItem(f.key);
  f.setCurrent(next);assert.throws(()=>f.wrapped.storage!.setItem(f.key,JSON.stringify(session(freshToken))));assert.equal(f.store.getItem(f.key),before);assert.equal(guard.saved(),false);guard.release();
 }
 checks.push('Owner, token, access-generation and signed-out changes fail both admission and the final synchronous save');
}
{
 for(const previous of [null,'malformed JSON',JSON.stringify(session(otherToken,other)),JSON.stringify(session(originalToken,other)),JSON.stringify(session(freshToken))]){
  const f=pure(),guard=f.wrapped.guard(freshToken,snapshot,f.current);
  if(previous===null)f.store.removeItem(f.key);else f.store.setItem(f.key,previous);
  assert.throws(()=>f.wrapped.storage!.setItem(f.key,JSON.stringify(session(freshToken))));assert.equal(f.store.getItem(f.key),previous);assert.equal(guard.saved(),false);guard.release();
 }
 const f=pure(),guard=f.wrapped.guard(freshToken,snapshot,f.current),before=f.store.getItem(f.key);
 assert.throws(()=>f.wrapped.storage!.setItem(f.key,JSON.stringify(session(freshToken,other))));assert.equal(f.store.getItem(f.key),before);guard.release();
 checks.push('Missing, malformed or changed actual storage and a wrong returned owner cannot authorize a guarded write');
}
{
 const f=await sdk();
 try{
  const guard=f.wrapped.guard(freshToken,snapshot,f.current);
  try{
   const result=await f.client.auth.setSession({access_token:freshToken,refresh_token:'synthetic-private-refresh'});
   assert.equal(result.error,null);assert.equal(guard.saved(),true);assert.equal(result.data.session?.user.id,owner);
   const saved=JSON.parse(f.store.getItem(f.storageKey)!);assert.equal(saved.access_token,freshToken);assert.equal(saved.refresh_token,'synthetic-private-refresh');assert.equal(saved.user.id,owner);assert(f.events.includes('SIGNED_IN'));
  }finally{guard.release();}
  const result=await f.client.auth.signInWithPassword({email:'synthetic@example.invalid',password:'Synthetic-test-only'});
  assert.equal(result.error,null);assert.equal(result.data.user?.id,other);assert.equal(JSON.parse(f.store.getItem(f.storageKey)!).access_token,otherToken);
  assert.equal(f.events.filter(event=>event==='SIGNED_IN').length,2);assert.deepEqual(f.calls,['/auth/v1/user','/auth/v1/token?grant_type=password']);
 }finally{f.close();}
 checks.push('Installed Supabase SDK setSession uses guarded storage and normal SIGNED_IN; ordinary password login still persists through the same storage');
}
{
 for(const race of ['owner','context','storage','expired-refresh','expired-refresh-401'] as const){
  const expired=race.startsWith('expired-refresh');
  const f=await sdk({deferUser:true,deferRefresh:true,refreshRejected:race==='expired-refresh-401'});
  // Auth JS rejects both setSession and its internal refresh Deferred when a
  // refresh save throws. Assert that extra safe rejection explicitly; it must
  // not become an unnoticed process failure or be mistaken for an Auth success.
  const internalRejections:unknown[]=[],observeInternal=(error:unknown)=>{internalRejections.push(error);};
  if(race==='expired-refresh')process.on('unhandledRejection',observeInternal);
  try{
   const target=expired?token(owner,freshLogin,Math.floor(Date.now()/1000)-1):freshToken;
   const guard=f.wrapped.guard(target,snapshot,f.current);
   try{
    const pending=f.client.auth.setSession({access_token:target,refresh_token:'synthetic-private-refresh'});await f.entered.promise;
    let expectedStored=f.store.getItem(f.storageKey);
    if(race==='owner'){f.setCurrent({ownerId:other,accessToken:otherToken,contextKey:'other-account'});expectedStored=JSON.stringify(session(otherToken,other));f.store.setItem(f.storageKey,expectedStored);}
    if(race==='context')f.setCurrent({...snapshot,contextKey:'changed-profile-generation'});
    if(race==='storage'||expired){expectedStored=JSON.stringify(session(otherToken,other));f.store.setItem(f.storageKey,expectedStored);}
    f.release.resolve();await assert.rejects(pending,/sign-in changed/);
    assert.equal(f.store.getItem(f.storageKey),expectedStored);assert.equal(guard.saved(),false);assert(!f.events.includes('SIGNED_IN'));assert(!f.events.includes('TOKEN_REFRESHED'));assert(!f.events.includes('SIGNED_OUT'));assert.deepEqual(f.calls,[expired?'/auth/v1/token?grant_type=refresh_token':'/auth/v1/user']);
    if(race==='expired-refresh'){
     await new Promise<void>(resolve=>setImmediate(resolve));
     assert.equal(internalRejections.length,1);assert(internalRejections[0] instanceof Error);assert.match(internalRejections[0].message,/sign-in changed/);sdkRefreshDeferredRejections++;
    }
   }finally{guard.release();}
  }finally{process.removeListener('unhandledRejection',observeInternal);f.release.resolve();f.close();}
 }
 checks.push('Real SDK deferred getUser, expired-target refresh and refresh-401 cleanup cannot overwrite/delete newer B or changed access, and emit no stale Auth success/sign-out');
}

console.log(JSON.stringify({passed:true,groups:checks.length,checks,installedSdk:true,sdkRefreshDeferredRejections,authHttp:'mocked in process',networkCalls:0,authWrites:0,businessWrites:0,inferenceCalls:0}));
