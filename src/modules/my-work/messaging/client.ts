import { supabase } from '@/lib/supabase';
import { generatePreview } from './preview';
import { INBOX_ATTACHMENT_BUCKET } from './files';
import { MessageTransfer, clearUploadUrls, uploadResumable, type Draft, type Transport } from './transfer';

async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T> {
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw new Error(error.message);
  return data as T;
}
export const transport: Transport = {
  begin: draft=>rpc('begin_my_work_attachment_transfer',{p_id:draft.id,p_recipient:draft.recipient,p_body:draft.body,p_job:draft.job||null,p_files:draft.entries}),
  status: id=>rpc('my_work_attachment_transfer_status',{p_id:id}),
  heartbeat:id=>rpc('heartbeat_my_work_attachment_transfer',{p_id:id}),
  preview:async(_id,entry,file,signal)=>{
    const preview=await generatePreview(file,entry.contentType,signal);if(!preview||signal.aborted)return;
    const bounded=AbortSignal.any([signal,AbortSignal.timeout(15000)]);
    const {data:path,error:reservationError}=await supabase.rpc('reserve_my_work_attachment_preview',{p_attachment:entry.id,p_bytes:preview.blob.size,p_width:preview.width,p_height:preview.height}).abortSignal(bounded);
    if(reservationError)throw reservationError;if(bounded.aborted)return;
    const {data:{session}}=await supabase.auth.getSession();if(!session)return;
    // Raw bounded body avoids multipart MIME inference. No upsert; retry cannot overwrite.
    const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${INBOX_ATTACHMENT_BUCKET}/${path}`,{method:'POST',signal:bounded,headers:{Authorization:`Bearer ${session.access_token}`,apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,'Content-Type':'application/octet-stream','Cache-Control':'max-age=0','x-upsert':'false'},body:preview.blob});
    if(!response.ok&&response.status!==409)throw Error('Preview unavailable.');
  },
  finalize:(id,count)=>rpc('finalize_my_work_inbox_message',{p_message_id:id,p_expected_attachment_count:count}),
  cancel:id=>rpc('cancel_my_work_attachment_transfer',{p_id:id}),
  discard:id=>rpc('discard_my_work_inbox_message_draft',{p_message_id:id}),
  remove:async(paths)=>{const{error}=await supabase.storage.from(INBOX_ATTACHMENT_BUCKET).remove(paths);if(error)throw new Error(error.message);},
  upload:(id,entry,file,signal,progress)=>uploadResumable({
    baseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,id,entry,file,signal,progress,
    credentials:async()=>{const{data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('Sign in required.');return{token:data.session.access_token,key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!};},
  }),
};
let current: MessageTransfer|null=null;
let actor='';
let unsubscribeCompletion: (()=>void)|undefined;
export const transferPending=(transfer:MessageTransfer|null)=>!!transfer&&!['sent','canceled'].includes(transfer.state.phase);
function trackCompletion(transfer:MessageTransfer) {
  unsubscribeCompletion?.();
  unsubscribeCompletion=transfer.subscribe(()=>{
    if(current===transfer&&!transferPending(transfer))saveRecovery(actor,null);
  });
}
const recoveryKey=(id:string)=>`tenops-messaging-transfer:${id}`;
const saveRecovery=(id:string,value:string|null)=>{try{if(value)sessionStorage.setItem(recoveryKey(id),value);else sessionStorage.removeItem(recoveryKey(id));}catch{/* Session recovery is best-effort; transfer itself remains available. */}};
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
export const subscribeTransfer=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const getTransfer=()=>current;
export const serverTransfer=()=>null;
export function startTransfer(userId:string,recipient:string,body:string,job:string,files:File[]) {
  if(transferPending(current))throw new Error('Finish or cancel the existing attachment transfer first.');
  actor=userId;
  let previous:string|null=null;try{previous=sessionStorage.getItem(recoveryKey(userId));}catch{/* unavailable */}
  if(previous){void recoverTransfer(userId);throw new Error('Checking the previous attachment transfer. Retry shortly; no new message was created.');}
  current=new MessageTransfer(files,recipient,body,job,transport);
  saveRecovery(actor,current.draft.id);
  trackCompletion(current);
  emit();
  void current.start();
  return current;
}
export function dismissTransfer() {
  if(transferPending(current))return;
  unsubscribeCompletion?.();
  saveRecovery(actor,null);current=null;emit();
}
async function recoverTransfer(userId:string) {
  if(current||typeof sessionStorage==='undefined')return;
  let id:string|null=null;try{id=sessionStorage.getItem(recoveryKey(userId));}catch{return;}
  if(!id)return;
  try{
    const draft=await rpc<Draft|null>('recover_my_work_attachment_transfer',{p_id:id});
    if(actor!==userId||current)return;
    if(!draft){saveRecovery(userId,null);return;}
    current=new MessageTransfer([],draft.recipient,draft.body,draft.job,transport,draft);trackCompletion(current);emit();
    // Checking the durable result does not require File handles or reupload bytes.
    void current.start();
  }catch{/* Leave the identifier for recovery on the next session event; no new send is created. */}
}
supabase.auth.onAuthStateChange((_event,session)=>{
  const next= session?.user.id??'';
  if(actor&&next!==actor){unsubscribeCompletion?.();current?.stopForSignOut();saveRecovery(actor,null);current=null;clearUploadUrls();emit();}
  actor=next;
  if(next)setTimeout(()=>void recoverTransfer(next),0);
});
