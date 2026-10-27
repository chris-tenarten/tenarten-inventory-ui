// Employee-safe excerpts only. Never import this server registry into the client bundle.
export const snapshot = {
  revision: 'f8f78c5', verifiedAt: '2026-10-27',
  receipt: 'docs/project-memory/2026-10-22-web-push-registration-reliability.md#executed-release--october-22-2026',
};
export type CapabilityEntry = {id:string; title:string; modules:string[]; terms:string; requiredTerms?:string[][]; status:'deployed'|'local'|'planned'|'unknown'; permission:string; additionalPermissions?:string[]; route:string|null; path:string; guidance:string; source:string; evidence:string};
const groups='docs/project-memory/2026-10-22-messaging-groups-replies-candidate.md#executed-release--2026-10-22';
export const registry:CapabilityEntry[]=[
 {id:'group',modules:['messaging'],title:'Create a group conversation',terms:'group conversation message messaging people chat',status:'deployed',permission:'messaging.write',route:'/my-work',path:'Messaging → New group',guidance:'Open Messaging from the app header. Choose New group, enter a group name, select at least one other participant, then choose Create group. Only the creator can rename the group or add/remove participants. Current members share the full history; removed members lose access. Previously signed attachment links may remain usable for up to ten minutes.',source:'Messaging groups and replies · released October 22',evidence:groups},
 {id:'dm',modules:['messaging'],title:'Add someone to a personal DM',terms:'add someone existing personal dm direct message third person',status:'deployed',permission:'messaging.write',route:'/my-work',path:'Messaging → New group',guidance:'Partially: you can start a new group, but you cannot add a third person to a personal DM. Create a new group instead. The old DM stays private and its history is not copied into the group.',source:'Messaging privacy contract · released October 22',evidence:groups},
 {id:'notifications',modules:['settings','messaging'],title:'Enable phone notifications',terms:'enable notification notifications phone iphone push home screen',status:'deployed',permission:'readOperationalData',route:'/settings',path:'Settings → device notifications',guidance:'On iPhone, open TenOps in Safari, choose Share → Add to Home Screen, then open the Home Screen app. In Settings, find device notifications and choose Enable notifications on this device. Allow the system permission prompt. If permission was denied, allow notifications in iPhone Settings and retry. Device registration does not guarantee that every notification will be presented.',source:'Device notification guide · reliability release October 22',evidence:snapshot.receipt},
 {id:'recurring',modules:['my-work'],title:'Recurring tasks',terms:'recurring repeat repeating task tasks schedule daily weekly',status:'unknown',permission:'readOperationalData',route:null,path:'',guidance:'The TenOps Guide does not have enough verified information to confirm recurring tasks. This does not mean the feature is unavailable. Please check with Product.',source:'Deployed capability review · October 27',evidence:'docs/project-memory/2026-10-27-tenbot-candidate.md'},
 {id:'share-job',modules:['messaging'],title:'Share a Job in a message',terms:'share job message link send',status:'unknown',permission:'messaging.write',route:null,path:'',guidance:'The TenOps Guide does not have enough verified information to confirm a dedicated Share Job control in Messaging. This does not mean the feature is unavailable. Please check with Product. Do not paste private Job records here.',source:'Messaging capability review · October 27',evidence:groups},
 {id:'sample-bid',modules:['intake','samples'],title:'Attach a Sample to a Bid',terms:'attach link sample bid samples',status:'unknown',permission:'viewIntake',route:null,path:'',guidance:'I cannot verify the exact deployed controls for attaching a Sample to a Bid. Please check with Product before relying on a workflow description.',source:'Intake workflow verification · October 27',evidence:'docs/project-memory/2026-10-13-bids-workstream-closure.md'},
 {id:'customer-history',modules:['contacts'],title:'Find a customer’s previous Jobs',terms:'customer previous jobs history contacts',status:'deployed',permission:'readOperationalData',route:'/contacts',path:'Contacts → Search customers → Linked Jobs → select a Job',guidance:'Open Contacts and search for the beginning of the customer’s company name. Choose Linked Jobs beside that customer, then select a Job to open it. This shows only visible Production Jobs linked to that directory customer. Historical customer text and Bid names do not establish a link; Proposal customer details are independent snapshots.',source:'Contacts guide · deployed release verified October 22',evidence:snapshot.receipt},
 {id:'customer-edit',modules:['contacts'],title:'Edit a saved customer’s details',terms:'edit update change correct modify saved customer customers details contact contacts company name phone email address',requiredTerms:[['customer','customers','contact','contacts','company'],['edit','update','change','correct','modify']],status:'deployed',permission:'writeBusinessData',additionalPermissions:['editProductionJobDetails'],route:'/contacts',path:'Toolbox → Resources → Contacts → Search customers → customer name → Customer Inspector → Save Changes',guidance:'Open Toolbox → Resources → Contacts. Search for the beginning of the customer’s company name, then select the company name to open Customer Inspector. Edit Customer / Company Name, or expand Additional Information (Optional) to edit Contact Name, Phone Number or Email Address. Choose Save Changes. Lead/Admin access is required to edit a saved customer; read-only accounts cannot save changes. Saved changes apply to future selections. Existing Jobs and Proposals keep their captured information.',source:'Contacts guide · released October 20',evidence:'docs/project-memory/2026-10-20-contacts-release.md'},
 {id:'material-lead',modules:['intake','inventory','samples'],title:'Material requirements and lead-time guidance',terms:'estimate material lead time times blend sheet inventory readiness accepted scope requirements intake',status:'local',permission:'viewIntake',route:null,path:'',guidance:'This capability is implemented in a local candidate and has not been released to employees. Do not rely on it as an available TenOps workflow. Supplier lead-time guidance remains subject to verified inputs and Product acceptance.',source:'Intake candidate · pending Product acceptance',evidence:'docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md'},
 {id:'intake-future',modules:['intake','samples'],title:'Further Intake intelligence',terms:'automatic supplier prediction historical sample intelligence forecast',status:'planned',permission:'viewIntake',route:null,path:'',guidance:'Further Intake intelligence is planned or deferred; I cannot describe it as available. A feature suggestion can capture the problem and desired behavior.',source:'Intake deferred boundaries',evidence:'docs/project-memory/OPEN_QUESTIONS.md'},
];
const stop=new Set('how do i can a an the to in is it my on of for me you someone'.split(' '));
// Explicit module names constrain guide relevance. Current-route context does
// not: an employee can ask about another module while working elsewhere.
const moduleNames:[string,RegExp][]=[
 ['manpower',/\bmanpower(?:[ -]+reporting)?\b/],
 ['messaging',/\b(?:messaging|inbox|dm|direct messages?)\b/],
 ['my-work',/\bmy[ -]+work\b/],
 ['settings',/\bsettings\b/],
 ['contacts',/\bcontacts\b/],
 ['intake',/\b(?:intake|pre[ -]+production)\b/],
 ['samples',/\bsamples\b/],
 ['inventory',/\binventory\b/],
 ['purchasing',/\bpurchasing\b/],
 ['production',/\b(?:in|from|using) (?:the )?production\b|\bproduction (?:module|workspace|pipeline)\b/],
];
const genericRecordWords=new Set(['job','jobs','existing']);
// Catalog matching may identify a denied public workflow, but only authorized
// entries may supply instructions, links or inference context.
export function hasGuidePermission(entry:CapabilityEntry,permissions:Set<string>){return [entry.permission,...entry.additionalPermissions||[]].every(permission=>permissions.has(permission));}
export function matchGuides(question:string){
 const query=question.toLowerCase(),explicitModules=moduleNames.filter(([,pattern])=>pattern.test(query)).map(([module])=>module);
 const moduleWords=new Set(moduleNames.flatMap(([,pattern])=>query.match(pattern)?.[0].match(/[a-z]+/g)||[]));
 const words=[...new Set(query.match(/[a-z]+/g)||[])].filter(w=>w.length>1&&!stop.has(w));
 return registry.filter(e=>!explicitModules.length||e.modules.some(module=>explicitModules.includes(module)))
  // Each required group needs one exact token: editing words and field names
  // alone must not turn unrelated Job/account questions into Contacts advice.
  .filter(e=>!e.requiredTerms||e.requiredTerms.every(group=>group.some(word=>words.includes(word))))
  .map(e=>({e,matches:words.filter(w=>(' '+e.terms+' ').includes(' '+w+' '))}))
  .filter(({matches})=>matches.some(word=>!genericRecordWords.has(word)&&!moduleWords.has(word)))
  .sort((a,b)=>b.matches.length-a.matches.length).map(x=>x.e);
}
export function retrieve(question:string,permissions:Set<string>){return matchGuides(question).filter(entry=>hasGuidePermission(entry,permissions)).slice(0,3);}
