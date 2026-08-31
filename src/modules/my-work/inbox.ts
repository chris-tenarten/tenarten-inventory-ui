import { supabase } from "@/lib/supabase";
import type { WorkCollaborator } from "./types";

export const TENOPS_SYSTEM_INBOX_USER_ID = "00000000-0000-0000-0000-000000000001";
export const isTenOpsSystemInboxUser = (userId: string) => userId === TENOPS_SYSTEM_INBOX_USER_ID;

export type InboxMessage = {
  id: string;
  senderUserId: string;
  senderName: string;
  recipientUserId: string;
  recipientName: string;
  body: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  readAt: string;
  createdAt: string;
  editedAt: string;
  attachments: InboxAttachment[];
};

export type InboxAttachment = { id: string; messageId: string; storagePath: string; originalFilename: string; contentType: string; byteSize: number; createdAt: string; previewUrl: string };

type InboxMessageRow = {
  id: string; sender_user_id: string; sender_name: string; recipient_user_id: string; recipient_name: string;
  body: string; job_id: string | null; job_number: string | null; job_name: string | null; read_at: string | null; created_at: string; edited_at: string | null;
};

export async function loadInboxMessages(): Promise<InboxMessage[]> {
  const { data, error } = await supabase.rpc("list_my_work_inbox_messages_v2");
  if (error) throw error;
  const messages = ((data ?? []) as InboxMessageRow[]).map((row): InboxMessage => ({
    id: row.id, senderUserId: row.sender_user_id, senderName: row.sender_name,
    recipientUserId: row.recipient_user_id, recipientName: row.recipient_name,
    body: row.body, jobId: row.job_id ?? "", jobNumber: row.job_number ?? "", jobName: row.job_name ?? "",
    readAt: row.read_at ?? "", createdAt: row.created_at, editedAt: row.edited_at ?? "", attachments: [],
  }));
  return messages;
}

export async function loadInboxUnreadCount(recipientUserId:string){const{count,error}=await supabase.from("my_work_messages").select("id",{count:"exact",head:true}).eq("recipient_user_id",recipientUserId).eq("delivery_status","ready").is("read_at",null);if(error)throw error;return count??0;}

export async function loadInboxAttachments(messageIds:string[]):Promise<InboxAttachment[]>{if(!messageIds.length)return[];const{data,error}=await supabase.from("my_work_message_attachments").select("id,message_id,storage_path,original_filename,content_type,byte_size,created_at").in("message_id",messageIds).order("created_at").order("id");if(error)throw error;return((data??[]) as Array<{id:string;message_id:string;storage_path:string;original_filename:string;content_type:string;byte_size:number;created_at:string}>).map(row=>({id:row.id,messageId:row.message_id,storagePath:row.storage_path,originalFilename:row.original_filename,contentType:row.content_type,byteSize:Number(row.byte_size),createdAt:row.created_at,previewUrl:""}));}

export async function loadInboxRecipients(): Promise<WorkCollaborator[]> {
  const { data, error } = await supabase.rpc("list_my_work_inbox_recipients");
  if (error) throw error;
  return ((data ?? []) as Array<{ user_id: string; display_name: string; role: string }>).map((row) => ({ userId: row.user_id, displayName: row.display_name, role: row.role }));
}

export async function sendInboxMessage(recipientUserId: string, body: string, jobId: string) {
  const { data, error } = await supabase.rpc("send_my_work_inbox_message", { p_recipient_user_id: recipientUserId, p_body: body, p_job_id: jobId || null });
  if (error) throw error;
  return String(data);
}

const INBOX_ATTACHMENT_BUCKET="my-work-inbox-attachments";
const safeFilename=(name:string)=>name.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]+/g,"_").replace(/\s+/g," ").trim().slice(0,180)||"attachment";

export async function sendInboxMessageWithAttachments(recipientUserId:string,body:string,jobId:string,files:File[],onStage?:(stage:'uploading'|'associating'|'finalizing')=>void){
  const user=await supabase.auth.getUser();if(user.error||!user.data.user)throw user.error??new Error("Sign in is required to attach files.");
  const draft=await supabase.rpc("create_my_work_inbox_message_draft",{p_recipient_user_id:recipientUserId,p_body:body,p_job_id:jobId||null});if(draft.error)throw draft.error;
  const messageId=String(draft.data);const uploaded:string[]=[];
  try{
    for(const file of files){
      if(file.size>26214400)throw new Error(`${file.name} exceeds the 25 MB attachment limit.`);
      const id=crypto.randomUUID();const storagePath=`${messageId}/${id}/${safeFilename(file.name)}`;const contentType=file.type||"application/octet-stream";
      onStage?.('uploading');const stored=await supabase.storage.from(INBOX_ATTACHMENT_BUCKET).upload(storagePath,file,{contentType,upsert:false});if(stored.error)throw stored.error;uploaded.push(storagePath);
      onStage?.('associating');
      const metadata=await supabase.from("my_work_message_attachments").insert({id,message_id:messageId,uploader_user_id:user.data.user.id,storage_path:storagePath,original_filename:file.name,content_type:contentType,byte_size:file.size});if(metadata.error)throw metadata.error;
    }
    onStage?.('finalizing');const finalized=await supabase.rpc("finalize_my_work_inbox_message",{p_message_id:messageId,p_expected_attachment_count:files.length});if(finalized.error)throw finalized.error;
    return messageId;
  }catch(caught){
    const removed=uploaded.length?await supabase.storage.from(INBOX_ATTACHMENT_BUCKET).remove(uploaded):{error:null};
    if(!removed.error)await supabase.rpc("discard_my_work_inbox_message_draft",{p_message_id:messageId});
    if(removed.error)throw new Error(`${caught instanceof Error?caught.message:"Unable to send message."} The private draft was retained because attachment cleanup did not complete.`);
    throw caught;
  }
}

export async function createInboxAttachmentUrl(attachment:InboxAttachment){const signed=await supabase.storage.from(INBOX_ATTACHMENT_BUCKET).createSignedUrl(attachment.storagePath,600);if(signed.error)throw signed.error;return signed.data.signedUrl;}
export async function openInboxAttachment(attachment:InboxAttachment){window.open(await createInboxAttachmentUrl(attachment),"_blank","noopener,noreferrer");}

export async function markInboxConversationRead(otherUserId: string) {
  const { error } = await supabase.rpc("mark_my_work_inbox_conversation_read", { p_other_user_id: otherUserId });
  if (error) throw error;
}

export async function editInboxMessage(messageId:string,body:string){const{error}=await supabase.rpc("edit_my_work_inbox_message",{p_message_id:messageId,p_body:body});if(error)throw error;}

export async function permanentlyDeleteInboxMessage(messageId:string){
  const prepared=await supabase.rpc("prepare_admin_delete_my_work_message",{p_message_id:messageId});if(prepared.error)throw prepared.error;
  const paths=((prepared.data??[]) as Array<{storage_path:string}>).map((row)=>row.storage_path);
  if(paths.length){const removed=await supabase.storage.from(INBOX_ATTACHMENT_BUCKET).remove(paths);if(removed.error)throw removed.error;}
  const deleted=await supabase.rpc("admin_permanently_delete_my_work_message",{p_message_id:messageId,p_confirmation:"PERMANENTLY_DELETE_MESSAGE"});if(deleted.error)throw deleted.error;
}
