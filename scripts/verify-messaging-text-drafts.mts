import assert from 'node:assert/strict';
import { TextDraft, DRAFT_TTL, MAX_DRAFTS } from '../src/lib/drafts/textDraft';
const values=new Map<string,string>();
const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
const draft=(owner='alice',peer='bob')=>new TextDraft(owner,'messaging',peer,()=>storage);
const first=draft();first.set('unfinished');first.flush();assert.equal(draft().text,'unfinished');
const other=draft('alice','carol');other.set('independent');other.flush();assert.equal(draft().text,'unfinished');assert.equal(draft('alice','carol').text,'independent');assert.equal(draft('eve').text,'');
const revision=first.snapshot();first.set('newer text');assert.equal(first.clearSent(revision),false);first.flush();assert.equal(draft().text,'newer text');
assert.equal(first.clearSent(first.snapshot()),true);assert.equal(draft().text,'');assert.equal(draft('alice','carol').text,'independent');
other.set('failed send');other.flush();assert.equal(draft('alice','carol').text,'failed send');
const reopened=draft('alice','carol');const stale=other.snapshot();reopened.set('new mount revision');reopened.flush();assert.equal(other.clearSent(stale),false);assert.equal(draft('alice','carol').text,'new mount revision');
other.set('   ');other.flush();assert.equal(values.size,0);
for(let i=0;i<MAX_DRAFTS+5;i++){const d=draft('alice',String(i));d.set('bounded');d.flush();}
assert.equal(Object.keys(JSON.parse(values.get(first.key)!)).length,MAX_DRAFTS);
values.set(first.key,JSON.stringify({bob:{text:'expired',updated:Date.now()-DRAFT_TTL-1,revision:'old'}}));assert.equal(draft().text,'');
values.set(first.key,'invalid');assert.equal(draft().text,'');
const unavailable=new TextDraft('alice','messaging','bob',()=>{throw Error('blocked');});unavailable.set('still usable');unavailable.flush();assert.equal(unavailable.text,'still usable');unavailable.clearSent(unavailable.snapshot());assert.equal(unavailable.text,'');
console.log('PASS restoration, independent peers, owner isolation, send revision race, failed-send retention, empty cleanup, TTL, bounds, malformed/unavailable storage. No network dependencies.');
