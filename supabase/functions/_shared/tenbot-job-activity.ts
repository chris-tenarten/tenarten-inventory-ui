/** Fixed, caller-JWT reads over the same Job Updates/activity used by Production.
 * No messages/tasks, arbitrary projections, seen-state mutation or write facade. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import type {JobToolCaller,JobToolQuery,JobQueryResult} from './tenbot-job-tools.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import type {KnowledgeProof} from './tenbot-agent-history-store.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {businessLabel,statement,qualification,type ReadAnswerFact} from './tenbot-read-composition.ts';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const timestamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
const digest=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const columns='id,job_id,created_at,edited_at,author_user_id,author_name,requires_follow_up,follow_up_assignee_user_id,follow_up_assignee_name,resolved_at';
/** Seven UUIDs (Job + up to six exact records) encode to 150 base64url
 * characters. The versioned prefix keeps the ID inside the existing 160-byte
 * proof contract. No labels, body text, token or permission is encoded. */
function encodeSet(job:string,ids:string[]){
 const values=[job,...ids];if(!uuid.test(job)||!ids.length||ids.length>6||new Set(ids).size!==ids.length||ids.some(id=>!uuid.test(id)))throw Error('record set');
 const hex=values.join('').replaceAll('-','').toLowerCase();
 return btoa(String.fromCharCode(...hex.match(/../g)!.map(v=>parseInt(v,16)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function decodeSet(encoded:string):{job:string;ids:string[]}|null{
 try{
  if(!/^[A-Za-z0-9_-]+$/.test(encoded)||encoded.length>150)return null;
  const bytes=atob(encoded.replaceAll('-','+').replaceAll('_','/'));if(bytes.length<32||bytes.length>112||bytes.length%16)return null;
  const values=[];for(let i=0;i<bytes.length;i+=16){const h=Array.from(bytes.slice(i,i+16),c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');values.push(`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`);}
  const [job,...ids]=values;if(ids.join(',')!==[...ids].sort().join(',')||encodeSet(job,ids)!==encoded)return null;return {job,ids};
 }catch{return null;}
}
export const isJobActivityProof=(id:string)=>/^job-(activity|update|event):/.test(id)||/^job\.[ue]2:/.test(id);
export type ActivityRecord={id:string;at:string;text:string;excerpt:boolean;author:string|null;open_follow_up?:boolean;resolved_at?:string|null;assignee?:string|null;unseen?:boolean;event_type?:string;edited_at?:string|null};
export type JobActivityResult={status:'ok'|'unavailable'|'not_authorized'|'invalid_request';complete:boolean;truncated:boolean;accessRefs:string[];proofs:KnowledgeProof[];data:{job:{job_id:string};source:'updates'|'activity';view:'recent'|'unseen'|'open_followups';records:ActivityRecord[];matching_count:number;general_unseen_count:number;total_updates:number;has_more:boolean;scanned:number}|null};
export type JobActivityReader={read(args:Record<string,unknown>):Promise<JobActivityResult>;sourceCurrent(proof:KnowledgeProof):Promise<boolean>};
/** ownerId is supplied only by the authenticated host, never model arguments. */
export function createJobActivityReader(caller:JobToolCaller,ownerId:string,deadlineMs=4000):JobActivityReader{
 const proofDigest=digest('tenbot-job-activity-access.v1:'+ownerId);
 const scope=async(id:string,signal:AbortSignal)=>{
  if(!uuid.test(ownerId)||!uuid.test(id))return false;
  for(const [name,args] of [['has_app_capability',{p_capability:'readOperationalData'}],['tenbot_authorize_history_jobs',{p_ids:[id]}]] as const){
   const request=caller.rpc(name,args) as JobToolQuery;
   const result=await bounded(request.abortSignal?request.abortSignal(signal):request,signal);
   if(result.error||result.data!==true)return false;
  }return true;
 };
 const query=(table:string,select:string,signal:AbortSignal,head=false)=>(caller.from(table) as {select(c:string,o?:{count:'exact';head:boolean}):JobToolQuery}).select(select,{count:'exact',head}).abortSignal(signal);
 async function rows(request:PromiseLike<JobQueryResult>,signal:AbortSignal){const r=await bounded(request,signal);if(r.error||!Array.isArray(r.data)||r.data.some(x=>!object(x)))throw Error('activity unavailable');return {rows:r.data as Record<string,unknown>[],count:r.count};}
 return {
  async read(args){
   const empty=(status:JobActivityResult['status']):JobActivityResult=>({status,complete:false,truncated:false,data:null,accessRefs:[],proofs:[]});
   if(Object.keys(args).some(k=>!['job_id','source','view','limit'].includes(k))||!uuid.test(String(args.job_id))||!['updates','activity'].includes(String(args.source))||!['recent','unseen','open_followups'].includes(String(args.view))||args.source==='activity'&&args.view!=='recent'||!Number.isSafeInteger(args.limit)||Number(args.limit)<1||Number(args.limit)>6)return empty('invalid_request');
   const id=String(args.job_id).toLowerCase(),source=args.source as 'updates'|'activity',view=args.view as 'recent'|'unseen'|'open_followups',limit=Number(args.limit),signal=AbortSignal.timeout(deadlineMs);
   try{
    if(!await scope(id,signal))return empty('not_authorized');
    // Read only this owner's watermark, plus the existing authority's aggregate.
    const seen=await rows(query('job_update_seen_state','last_seen_at',signal).eq('user_id',ownerId).eq('job_id',id).limit(1),signal);
    const lastSeen=seen.rows[0]?.last_seen_at??null;if(lastSeen!==null&&!timestamp(lastSeen))throw Error('watermark');
    const unseenRequest=caller.rpc('list_my_unseen_job_update_jobs') as JobToolQuery;
    const unseen=await rows(unseenRequest.eq('job_id',id).range(0,1).abortSignal(signal),signal);
    if(unseen.rows.length>1||unseen.rows.some(r=>r.job_id!==id||!Number.isSafeInteger(Number(r.unseen_count))||Number(r.unseen_count)<0))throw Error('unseen');
    const unseenCount=Number(unseen.rows[0]?.unseen_count??0);
    const count=await bounded(query('job_updates','id',signal,true).eq('job_id',id),signal);
    if(count.error||!Number.isSafeInteger(count.count)||Number(count.count)<0)throw Error('count');
    let records:ActivityRecord[]=[],matching=0,scanned=0;
    if(source==='updates'){
     let request=query('job_updates',columns,signal).eq('job_id',id);
     if(view==='open_followups')request=request.eq('requires_follow_up',true).is('resolved_at',null);
     // Unseen matching scans at most 100 metadata rows, never 100 bodies. An
     // older unseen post outside this bound remains explicitly unreturned.
     const cap=view==='unseen'?100:limit;
     const metadata=await rows(request.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(cap),signal);scanned=metadata.rows.length;
     if(!Number.isSafeInteger(metadata.count)||Number(metadata.count)<metadata.rows.length)throw Error('count');
     for(const r of metadata.rows)if(!uuid.test(String(r.id))||r.job_id!==id||!timestamp(r.created_at)||typeof r.requires_follow_up!=='boolean'||r.resolved_at!==null&&!timestamp(r.resolved_at)||r.author_user_id!==null&&!uuid.test(String(r.author_user_id))||r.follow_up_assignee_user_id!==null&&!uuid.test(String(r.follow_up_assignee_user_id)))throw Error('record');
     const mentions=metadata.rows.length?await rows(query('job_update_mentions','job_update_id',signal).eq('user_id',ownerId).in('job_update_id',metadata.rows.map(r=>String(r.id))).limit(101),signal):{rows:[],count:0};
     if(mentions.rows.length>100||mentions.rows.some(r=>!metadata.rows.some(m=>m.id===r.job_update_id)))throw Error('mentions');
     const mentioned=new Set(mentions.rows.map(r=>r.job_update_id));
     const isUnseen=(r:Record<string,unknown>)=>(lastSeen===null||Date.parse(String(r.created_at))>Date.parse(lastSeen))&&r.author_user_id!==ownerId&&!mentioned.has(r.id)&&!(r.requires_follow_up&&r.follow_up_assignee_user_id===ownerId);
     const selected=metadata.rows.filter(r=>view!=='unseen'||isUnseen(r)).slice(0,limit);
     const bodies=selected.length?await rows(query('job_updates','id,job_id,body',signal).eq('job_id',id).in('id',selected.map(r=>String(r.id))).limit(limit),signal):{rows:[]};
     records=selected.map(r=>{
      const body=bodies.rows.find(b=>b.id===r.id&&b.job_id===id)?.body;
      if(typeof body!=='string'||body.length>20000||typeof r.author_name==='string'&&r.author_name.length>120||typeof r.follow_up_assignee_name==='string'&&r.follow_up_assignee_name.length>120)throw Error('body');
      const normalized=businessLabel(body);
      return {id:String(r.id),at:String(r.created_at),text:normalized.slice(0,650),excerpt:normalized.length>650,author:typeof r.author_name==='string'?r.author_name:null,edited_at:r.edited_at as string|null,open_follow_up:r.requires_follow_up===true&&r.resolved_at===null,resolved_at:r.resolved_at as string|null,assignee:typeof r.follow_up_assignee_name==='string'?r.follow_up_assignee_name:null,unseen:isUnseen(r)};
     });
     matching=view==='unseen'?unseenCount:Number(metadata.count);
     // Detect disagreement with the caller-owned RPC rather than manufacture
     // a personally unseen label from inconsistent multi-query evidence.
     if(view==='unseen'&&(records.length>matching||metadata.rows.length===Number(metadata.count)&&selected.length<Math.min(limit,matching)))throw Error('unseen mismatch');
    }else{
     const events=await rows(query('job_activity','id,job_id,event_type,summary,actor_name,occurred_at',signal).eq('job_id',id).order('occurred_at',{ascending:false}).order('id',{ascending:false}).limit(limit),signal);
     if(!Number.isSafeInteger(events.count)||Number(events.count)<events.rows.length)throw Error('count');matching=Number(events.count);scanned=events.rows.length;
     records=events.rows.map(r=>{if(!uuid.test(String(r.id))||r.job_id!==id||!timestamp(r.occurred_at)||typeof r.summary!=='string'||r.summary.length>20000||typeof r.actor_name==='string'&&r.actor_name.length>120)throw Error('event');const normalized=businessLabel(r.summary);return {id:String(r.id),at:r.occurred_at,text:normalized.slice(0,650),excerpt:normalized.length>650,author:typeof r.actor_name==='string'?r.actor_name:null,...(typeof r.event_type==='string'&&r.event_type.length<=80?{event_type:r.event_type}:{})};});
    }
    if(!await scope(id,signal))return empty('not_authorized');
    const ids=records.map(r=>r.id).sort(),setId=ids.length?`job.${source==='updates'?'u':'e'}2:${encodeSet(id,ids)}`:null;
    const proofs=[{id:'job-activity:'+id,digest:await proofDigest},...(setId?[{id:setId,digest:await digest('tenbot-job-activity-set.v2:'+ownerId+':'+setId)}]:[])];
    return {status:'ok',complete:true,truncated:records.length<matching,accessRefs:[id],proofs,data:{job:{job_id:id},source,view,records,matching_count:matching,general_unseen_count:unseenCount,total_updates:Number(count.count),has_more:records.length<matching,scanned}};
   }catch{return empty('unavailable');}
  },
  async sourceCurrent(proof){
   const group=/^job\.([ue])2:([A-Za-z0-9_-]+)$/.exec(proof.id);
   if(group){
    const set=decodeSet(group[2]);if(!set||proof.digest!==await digest('tenbot-job-activity-set.v2:'+ownerId+':'+proof.id))return false;
    const signal=AbortSignal.timeout(deadlineMs);
    try{
     if(!await scope(set.job,signal))return false;
     const table=group[1]==='u'?'job_updates':'job_activity';
     const result=await rows(query(table,'id,job_id',signal).eq('job_id',set.job).in('id',set.ids).limit(set.ids.length+1),signal);
     if(result.rows.length!==set.ids.length||new Set(result.rows.map(r=>r.id)).size!==set.ids.length||result.rows.some(r=>r.job_id!==set.job||!set.ids.includes(String(r.id))))return false;
     return await scope(set.job,signal);
    }catch{return false;}
   }
   // Retain old per-record proofs for already saved display history.
   const parts=/^job-(activity|update|event):([a-f0-9-]{36})(?::([a-f0-9-]{36}))?$/.exec(proof.id);
   if(!parts||!uuid.test(parts[2])||parts[1]==='activity'&&parts[3]!==undefined||parts[1]!=='activity'&&!uuid.test(parts[3]??'')||proof.digest!==await proofDigest)return false;
   const signal=AbortSignal.timeout(deadlineMs);
   try{
    if(!await scope(parts[2],signal))return false;
    if(parts[1]==='activity'){await rows(query('job_update_seen_state','job_id',signal).eq('user_id',ownerId).eq('job_id',parts[2]).limit(1),signal);return true;}
    const r=await rows(query(parts[1]==='update'?'job_updates':'job_activity','id,job_id',signal).eq('job_id',parts[2]).eq('id',parts[3]).limit(1),signal);
    return r.rows.length===1&&r.rows[0].id===parts[3]&&r.rows[0].job_id===parts[2];
   }catch{return false;}
  },
 };
}
async function bounded<T>(request:PromiseLike<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted)throw Error('deadline');let abort:()=>void=()=>{};
 try{return await Promise.race([Promise.resolve(request),new Promise<never>((_,reject)=>{abort=()=>reject(Error('deadline'));signal.addEventListener('abort',abort,{once:true});})]);}finally{signal.removeEventListener('abort',abort);}
}
/** Attributed employee posts and saved events are evidence, never instructions
 * or independently verified causation. Selected excerpts retain that qualifier. */
export function jobActivityFacts(result:JobActivityResult):ReadAnswerFact[]{
 if(!result.data||result.status!=='ok')return [statement('activity_unavailable',result.status==='not_authorized'?'This Job’s updates are not available under your current access.':result.status==='invalid_request'?'That activity view is unavailable. I can check recent saved events, or recent updates and their open follow-ups.':'I couldn’t retrieve the saved Job updates or activity right now. Please try again.')];
 const d=result.data,facts:ReadAnswerFact[]=[],required:string[]=[];
 const q=(id:string,key:string,text:string)=>{facts.push(qualification(id,key,text));required.push(id);};
 if(!result.complete)q('activity_incomplete','activity-incomplete:'+d.job.job_id,'Some saved activity could not be checked; this is not a complete investigation.');
 else if(d.has_more)q('activity_bounds',`activity-bounds:${d.job.job_id}:${d.source}:${d.view}`,'This covers only the saved activity returned, not the full history.');
 if(result.complete){
  facts.push(statement('activity_counts',`${d.total_updates} Job Updates are saved; ${d.general_unseen_count} ${d.general_unseen_count===1?'is':'are'} unseen in your general Job-update indicator.`,[],'activity'));
  facts.push(qualification('activity_unseen_meaning','general-job-unseen','The Job-row indicator is separate from personal notification unread status.'));
  facts.find(f=>f.id==='activity_counts')!.composition!.requires=['activity_unseen_meaning'];
 }
 // Compact briefing is extractive, not a semantic rewrite. Never cut a
 // sentence/negation out of a post to manufacture a shorter factual claim.
 // Whole posts stay available; short complete posts also get a concise frame.
 const briefRequired:string[]=[];
 const briefQ=(id:string,key:string,text:string)=>{facts.push(qualification(id,key,text));briefRequired.push(id);};
 if(!result.complete)briefQ('brief_activity_incomplete','activity-incomplete:'+d.job.job_id,'Some saved activity could not be checked; this is not a complete investigation.');
 else if(d.has_more)briefQ('brief_activity_bounds',`activity-bounds:${d.job.job_id}:${d.source}:${d.view}`,'This covers only the saved activity returned, not the full history.');
 if(d.source==='updates'){
  briefQ('brief_activity_reported','activity-reported:'+d.job.job_id,'These are dated employee reports, not independent confirmation that planned work was completed.');
  if(d.records.some(r=>r.excerpt||businessLabel(r.text).length>200))briefQ('brief_activity_long_context','activity-long-context:'+d.job.job_id,'Longer updates are also saved in Job Updates; their full context is not summarized here.');
 }
 for(const [i,r] of d.records.entries()){
  const excerpt=businessLabel(r.text),when=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',timeZoneName:'short'}).format(new Date(r.at));
  const attribution=d.source==='updates'?`${r.author?businessLabel(r.author):'An employee'} posted`:'Saved activity';
  const state=d.source==='updates'?(r.open_follow_up?`Open follow-up${r.assignee?' assigned to '+businessLabel(r.assignee):''}. `:r.resolved_at?`Follow-up resolved ${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Chicago'}).format(new Date(r.resolved_at))}. `:''):'';
  // Attribution is part of the statement itself: the host says who posted
  // what, not that a quoted claim is established operational causation.
  facts.push(statement('activity_'+(i+1),`${state}${attribution} (${when}): “${excerpt}${r.excerpt?'…':''}”${r.excerpt?' (excerpt)':''}`,[...required],'activity'));
  if(d.source==='activity'){
   const types:Record<string,string>={production_schedule_changed:'a Production schedule change',attachments_uploaded:'an attachment upload',job_updated:'a Job edit',job_created:'Job creation'};
   const latest=i===0&&d.view==='recent'&&result.complete,typed=types[r.event_type??''];
   facts.push(statement('brief_activity_'+(i+1),typed?`${latest?'The latest saved activity was':'Saved activity records'} ${typed} (${when}).`:`${latest?'The latest saved activity':'Saved activity'} (${when}): “${excerpt}${r.excerpt?'…':''}”${r.excerpt?' (excerpt)':''}`,[...briefRequired.filter(id=>!latest||id!=='brief_activity_bounds')],'activity'));
  }else if(!r.excerpt&&excerpt.length<=200){
   const heading=d.view==='unseen'?'Unseen update':i===0&&d.view==='recent'&&result.complete?'Latest saved update':'Saved update';
   facts.push(statement('brief_activity_'+(i+1),`${state}${heading} — ${r.author?businessLabel(r.author):'an employee'}, ${when}: “${excerpt}”`,[...briefRequired],'activity'));
  }

 }
 if(!d.records.length)facts.push(statement('activity_empty',!result.complete?'I couldn’t verify the saved activity; no complete list or zero total is established.':d.matching_count>0?'Matching updates exist, but none could be returned within this bounded search.':`No ${d.view==='unseen'?'unseen general Job Updates':d.view==='open_followups'?'open Job-update follow-ups':d.source==='updates'?'Job Updates':'saved Job activity'} were found.`,required,'activity'));
 return facts;
}
