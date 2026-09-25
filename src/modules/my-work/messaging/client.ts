import { supabase } from '@/lib/supabase';
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
const recoveryKey=(id:string)=>`tenops-messaging-transfer:${id}`;
const saveRecovery=(id:string,value:string|null)=>{try{if(value)sessionStorage.setItem(recoveryKey(id),value);else sessionStorage.removeItem(recoveryKey(id));}catch{/* Session recovery is best-effort; transfer itself remains available. */}};
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
export const subscribeTransfer=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const getTransfer=()=>current;
export const serverTransfer=()=>null;
export function startTransfer(userId:string,recipient:string,body:string,job:string,files:File[]) {
  if(current)throw new Error('Finish or dismiss the existing attachment transfer first.');
  actor=userId;
  let previous:string|null=null;try{previous=sessionStorage.getItem(recoveryKey(userId));}catch{/* unavailable */}
  if(previous){void recoverTransfer(userId);throw new Error('Checking the previous attachment transfer. Retry shortly; no new message was created.');}
  current=new MessageTransfer(files,recipient,body,job,transport);
  saveRecovery(actor,current.draft.id);
  emit();
  void current.start();
  return current;
}
export function dismissTransfer() {
  if(current&&!['sent','canceled'].includes(current.state.phase))return;
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
    current=new MessageTransfer([],draft.recipient,draft.body,draft.job,transport,draft);emit();
    // Checking the durable result does not require File handles or reupload bytes.
    void current.start();
  }catch{/* Leave the identifier for recovery on the next session event; no new send is created. */}
}
supabase.auth.onAuthStateChange((_event,session)=>{
  const next= session?.user.id??'';
  if(actor&&next!==actor){current?.stopForSignOut();saveRecovery(actor,null);current=null;clearUploadUrls();emit();}
  actor=next;
  if(next)setTimeout(()=>void recoverTransfer(next),0);
});
