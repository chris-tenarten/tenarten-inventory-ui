// Opaque locator privacy/lifecycle checks only: no provider, credentials or DB.
import assert from 'node:assert/strict';
import {clearHistoryLocator,historyAccessHash,readHistoryLocator,saveHistoryLocator,TENBOT_HISTORY_LOCATOR_KEY,type HistoryBinding} from '../src/modules/tenbot/conversation-history';
const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
const binding:HistoryBinding={owner:'11111111-1111-4111-8111-111111111111',accessHash:await historyAccessHash('verified-profile'),mode:'synthetic'};
const id='22222222-2222-4222-8222-222222222222',now=1000000000,checks:string[]=[];
function test(name:string,run:()=>void){clearHistoryLocator(storage);run();checks.push(name);}
test('tab locator contains only opaque identity/access/mode/expiry metadata',()=>{
 saveHistoryLocator(binding,id,storage,now);const saved=JSON.parse(values.get(TENBOT_HISTORY_LOCATOR_KEY)!);
 assert.deepEqual(Object.keys(saved).sort(),['accessHash','conversationId','expiresAt','mode','owner','version']);
 assert.equal(saved.accessHash.length,64);assert(!JSON.stringify(saved).includes('verified-profile'));
 assert.equal(readHistoryLocator(binding,storage,now+1),id);
});
test('another owner, changed access or different provider mode cannot reuse the locator',()=>{
 for(const change of [{owner:'another-owner'},{accessHash:'changed-grants'},{mode:'authenticated' as const}]){saveHistoryLocator(binding,id,storage,now);assert.equal(readHistoryLocator({...binding,...change},storage,now+1),null);assert.equal(values.size,0);}
});
test('expiry, malformed IDs and injected content fail closed',()=>{
 saveHistoryLocator(binding,id,storage,now);assert.equal(readHistoryLocator(binding,storage,now+3600000),null);
 for(const change of [{conversationId:'invalid'},{expiresAt:now+3600001},{version:2},{message:'Do not cache answer text'}]){saveHistoryLocator(binding,id,storage,now);const value=JSON.parse(values.get(TENBOT_HISTORY_LOCATOR_KEY)!);storage.setItem(TENBOT_HISTORY_LOCATOR_KEY,JSON.stringify({...value,...change}));assert.equal(readHistoryLocator(binding,storage,now),null);}
});
test('write-restricted storage falls back to the opaque identifier without reviving cleared history',()=>{
 const blocked={...storage,setItem(){throw new Error('Storage quota or policy');}};
 saveHistoryLocator(binding,id,blocked,now);assert.equal(values.size,0);assert.equal(readHistoryLocator(binding,blocked,now+1),id);
 clearHistoryLocator(blocked);assert.equal(readHistoryLocator(binding,blocked,now+1),null);
});
test('clearing and malformed JSON never restore a prior locator',()=>{
 saveHistoryLocator(binding,id,storage,now);clearHistoryLocator(storage);assert.equal(readHistoryLocator(binding,storage,now+1),null);
 saveHistoryLocator(binding,id,storage,now);storage.setItem(TENBOT_HISTORY_LOCATOR_KEY,'{invalid');assert.equal(readHistoryLocator(binding,storage,now+1),null);
});
console.log(JSON.stringify({status:'pass',groups:checks.length,checks,inferenceCalls:0,databaseRequests:0},null,2));
