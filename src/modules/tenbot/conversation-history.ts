/** An opaque, tab-local locator only. Answer text and operational evidence are
 * never written to browser storage; the server reauthorizes every hydration. */
export const TENBOT_HISTORY_LOCATOR_KEY='tenops.tenbot.experimental-conversation.v1';
export type HistoryBinding={owner:string;accessHash:string;mode:'synthetic'|'authenticated'|'hosted'};
type Locator=HistoryBinding&{version:1;conversationId:string;expiresAt:number};
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const lifetime=3600000;
let memoryLocator:Locator|null=null;
let memoryOnly=false;
export async function historyAccessHash(fingerprint:string):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function storage():StorageLike|undefined{try{return typeof window==='undefined'?undefined:window.sessionStorage;}catch{return undefined;}}
export function clearHistoryLocator(target:StorageLike|undefined=storage()){
 memoryLocator=null;memoryOnly=false;try{target?.removeItem(TENBOT_HISTORY_LOCATOR_KEY);}catch{memoryOnly=true;/* Do not revive a locator whose removal was blocked. */}
}
export function readHistoryLocator(binding:HistoryBinding,target:StorageLike|undefined=storage(),now=Date.now()):string|null{
 let value:unknown=memoryLocator;
 try{if(target&&!memoryOnly){const raw=target.getItem(TENBOT_HISTORY_LOCATOR_KEY);if(raw){try{value=JSON.parse(raw);}catch{clearHistoryLocator(target);return null;}}else value=null;}}catch{memoryOnly=true;/* An opaque in-memory locator can survive ordinary component remounts. */}
 const candidate=value as Partial<Locator>|null;
 if(!candidate||Object.keys(candidate).some(key=>!['version','owner','accessHash','mode','conversationId','expiresAt'].includes(key))||candidate.version!==1||typeof candidate.conversationId!=='string'||!uuid.test(candidate.conversationId)||candidate.owner!==binding.owner||candidate.accessHash!==binding.accessHash||candidate.mode!==binding.mode||typeof candidate.expiresAt!=='number'||!Number.isFinite(candidate.expiresAt)||candidate.expiresAt<=now||candidate.expiresAt>now+lifetime){clearHistoryLocator(target);return null;}
 memoryLocator=candidate as Locator;return candidate.conversationId;
}
export function saveHistoryLocator(binding:HistoryBinding,conversationId:string,target:StorageLike|undefined=storage(),now=Date.now()){
 if(!uuid.test(conversationId))return;
 const locator:Locator={version:1,owner:binding.owner,accessHash:binding.accessHash,mode:binding.mode,conversationId,expiresAt:now+lifetime};
 memoryLocator=locator;memoryOnly=!target;try{target?.setItem(TENBOT_HISTORY_LOCATOR_KEY,JSON.stringify(locator));}catch{memoryOnly=true;/* The fallback retains this identifier, never an answer or tool result. */}
}
