/** Same Auth storage, with a one-use compare-and-set at the SDK's session save.
 * The SDK calls setItem while holding its ordinary auth-token lock. No password
 * is accepted here; failed checks leave the newer login untouched. */
export type ActionSessionSnapshot={ownerId:string;accessToken:string;contextKey:string};
type Store={getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void};
type Guard={token:string;sessionId:string;expected:ActionSessionSnapshot;current():ActionSessionSnapshot|null;used:boolean};
const same=(a:ActionSessionSnapshot,b:ActionSessionSnapshot|null)=>!!b&&a.ownerId===b.ownerId&&a.accessToken===b.accessToken&&a.contextKey===b.contextKey;
function sessionId(token:string):string{
 try{const value=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return typeof value.session_id==='string'?value.session_id:'';}catch{return '';}
}
export function createActionSessionStorage(backing?:Store){
 let guard:Guard|null=null;
 let removalToken:string|null=null;
 const storage=backing?{
  getItem:(key:string)=>backing.getItem(key),
  removeItem(key:string){
   let saved:{access_token?:string}|null=null;try{saved=JSON.parse(backing.getItem(key)??'null');}catch{/* Non-session SDK keys are ordinary storage. */}
   // A rejected target refresh can ask the SDK to remove the current login.
   // Only an explicit normal sign-out may remove that session during handoff.
   if(guard&&saved?.access_token&&saved.access_token!==removalToken)throw Error('Your sign-in changed. Reopen TenBot to check the saved result.');
   backing.removeItem(key);
  },
  setItem(key:string,value:string){
   let next:{access_token?:string;user?:{id?:string}}|null=null;
   try{next=JSON.parse(value);}catch{/* Other SDK storage values are unchanged. */}
   if(guard&&next?.access_token&&(next.access_token===guard.token||sessionId(next.access_token)===guard.sessionId)){
    let previous:{access_token?:string;user?:{id?:string}}|null=null;
    try{previous=JSON.parse(backing.getItem(key)??'null');}catch{/* Missing storage cannot authorize a handoff. */}
    if(guard.used||next.access_token!==guard.token||!same(guard.expected,guard.current())||previous?.access_token!==guard.expected.accessToken||previous?.user?.id!==guard.expected.ownerId||next.user?.id!==guard.expected.ownerId)throw Error('Your sign-in changed. Reopen TenBot to check the saved result.');
    // Synchronous check+write under the SDK's existing token lock. No await or
    // user callback is allowed between this comparison and the actual write.
    backing.setItem(key,value);guard.used=true;return;
   }
   backing.setItem(key,value);
  },
 }:undefined;
 return {storage,allowSignOut(token:string){removalToken=token;return()=>{if(removalToken===token)removalToken=null;};},guard(token:string,expected:ActionSessionSnapshot,current:()=>ActionSessionSnapshot|null){
  const targetSession=sessionId(token);
  if(!backing||guard||!token||!targetSession||!same(expected,current()))throw Error('Your sign-in changed. Reopen TenBot to check the saved result.');
  const pending:Guard={token,sessionId:targetSession,expected:{...expected},current,used:false};guard=pending;
  return {saved:()=>pending.used,release(){if(guard===pending)guard=null;pending.token='';pending.expected.accessToken='';}};
 }};
}
export function browserAuthStorage():Store|undefined{
 if(typeof window==='undefined')return undefined;
  try{const store=window.localStorage,key='tenops-auth-storage-check-'+crypto.randomUUID();store.setItem(key,'1');store.removeItem(key);return store;}catch{return undefined;}
}
