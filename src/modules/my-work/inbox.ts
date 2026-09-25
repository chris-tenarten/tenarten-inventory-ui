import type { PreviewMetadata } from "./messaging/preview";
import { INBOX_ATTACHMENT_BUCKET, downloadUrl } from "./messaging/files";
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

export type InboxAttachment = { id: string; messageId: string; storagePath: string; originalFilename: string; contentType: string; byteSize: number; createdAt: string; previewUrl: string; preview?: PreviewMetadata | null };

type InboxMessageRow = {
  id: string; sender_user_id: string; sender_name: string; recipient_user_id: string; recipient_name: string;
  body: string; job_id: string | null; job_number: string | null; job_name: string | null; read_at: string | null; created_at: string; edited_at: string | null;
};

export type ConversationSummary={userId:string;name:string;role:string;unread:number;latest:{id:string;createdAt:string;body:string}};
export async function loadConversationSummaries():Promise<ConversationSummary[]>{
  const {data,error}=await supabase.rpc("list_my_work_conversations_v11");if(error)throw error;return data??[];
}
export type MessageCursor={createdAt:string;id:string};
export async function loadMessagePage(peer:string,before?:MessageCursor,ids?:string[]):Promise<InboxMessage[]>{
  const {data,error}=await supabase.rpc("list_my_work_message_page_v11",{p_peer:peer,p_before_time:before?.createdAt??null,p_before_id:before?.id??null,p_ids:ids??null});
  if(error)throw error;
  return (data??[]).map((row:InboxMessageRow&{attachments:Array<{id:string;message_id:string;storage_path:string;original_filename:string;content_type:string;byte_size:number;created_at:string;preview:PreviewMetadata|null}>}):InboxMessage=>({
    id:row.id,senderUserId:row.sender_user_id,senderName:row.sender_name,recipientUserId:row.recipient_user_id,recipientName:row.recipient_name,
    body:row.body,jobId:row.job_id??"",jobNumber:row.job_number??"",jobName:row.job_name??"",readAt:row.read_at??"",createdAt:row.created_at,editedAt:row.edited_at??"",
    attachments:row.attachments.map(a=>({id:a.id,messageId:a.message_id,storagePath:a.storage_path,originalFilename:a.original_filename,contentType:a.content_type,byteSize:Number(a.byte_size),createdAt:a.created_at,previewUrl:"",preview:a.preview})),
  }));
}

export async function loadInboxUnreadCount(recipientUserId:string){const{count,error}=await supabase.from("my_work_messages").select("id",{count:"exact",head:true}).eq("recipient_user_id",recipientUserId).eq("delivery_status","ready").is("read_at",null);if(error)throw error;return count??0;}

export async function loadInboxRecipients(): Promise<WorkCollaborator[]> {
  const { data, error } = await supabase.rpc("list_my_work_inbox_recipients");
  if (error) throw error;
  return ((data ?? []) as Array<{ user_id: string; display_name: string; role: string }>).map((row) => ({ userId: row.user_id, displayName: row.display_name, role: row.role }));
}

export async function sendInboxMessage(recipientUserId: string, body: string) {
  const { data, error } = await supabase.rpc("send_my_work_inbox_message", { p_recipient_user_id: recipientUserId, p_body: body, p_job_id: null });
  if (error) throw error;
  return String(data);
}

export async function createInboxAttachmentUrl(attachment:InboxAttachment){const signed=await supabase.storage.from(INBOX_ATTACHMENT_BUCKET).createSignedUrl(attachment.storagePath,600);if(signed.error)throw signed.error;return signed.data.signedUrl;}
export async function openInboxAttachment(attachment:InboxAttachment){
  const url=downloadUrl(await createInboxAttachmentUrl(attachment),attachment.originalFilename);
  const link=document.createElement('a');link.href=url;link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';link.target='_blank';
  document.body.appendChild(link);link.click();link.remove();
}

export async function markInboxConversationRead(otherUserId: string) {
  const { error } = await supabase.rpc("mark_my_work_inbox_conversation_read", { p_other_user_id: otherUserId });
  if (error) throw error;
}

export async function editInboxMessage(messageId:string,body:string){const{error}=await supabase.rpc("edit_my_work_inbox_message",{p_message_id:messageId,p_body:body});if(error)throw error;}

export async function permanentlyDeleteInboxMessage(messageId:string){
  const {data,error}=await supabase.functions.invoke("admin-delete-messaging-message",{body:{messageId,confirmation:"PERMANENTLY_DELETE_MESSAGE"}});
  if(error)throw new Error("Message deletion did not complete. Retry to reconcile its attachment cleanup.");
  if(!data||!["deleted","already_deleted"].includes(data.status))throw new Error("Message deletion was not confirmed.");
}
