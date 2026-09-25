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

export type RecentInboxMessage={id:string;senderUserId:string;recipientUserId:string;body:string;readAt:string;createdAt:string};
export async function loadRecentInboxMessages(limit=40):Promise<RecentInboxMessage[]>{
  const{data,error}=await supabase.from("my_work_messages").select("id,sender_user_id,recipient_user_id,body,read_at,created_at").eq("delivery_status","ready").order("created_at",{ascending:false}).order("id",{ascending:false}).limit(limit);
  if(error)throw error;
  return((data??[]) as Array<{id:string;sender_user_id:string;recipient_user_id:string;body:string;read_at:string|null;created_at:string}>).map(row=>({id:row.id,senderUserId:row.sender_user_id,recipientUserId:row.recipient_user_id,body:row.body,readAt:row.read_at??"",createdAt:row.created_at}));
}

export async function loadInboxAttachments(messageIds:string[]):Promise<InboxAttachment[]>{
  const result:InboxAttachment[]=[];
  for(let batch=0;batch<messageIds.length;batch+=50){
    for(let offset=0;;offset+=500){
      const{data,error}=await supabase.from("my_work_message_attachments").select("id,message_id,storage_path,original_filename,content_type,byte_size,created_at").in("message_id",messageIds.slice(batch,batch+50)).order("created_at").order("id").range(offset,offset+499);
      if(error)throw error;
      for(const row of data??[])result.push({id:row.id,messageId:row.message_id,storagePath:row.storage_path,originalFilename:row.original_filename,contentType:row.content_type,byteSize:Number(row.byte_size),createdAt:row.created_at,previewUrl:""});
      if((data?.length??0)<500)break;
    }
  }
  return result;
}

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
  const prepared=await supabase.rpc("prepare_admin_delete_my_work_message",{p_message_id:messageId});if(prepared.error)throw prepared.error;
  const paths=((prepared.data??[]) as Array<{storage_path:string}>).map((row)=>row.storage_path);
  if(paths.length){const removed=await supabase.storage.from(INBOX_ATTACHMENT_BUCKET).remove(paths);if(removed.error)throw removed.error;}
  const deleted=await supabase.rpc("admin_permanently_delete_my_work_message",{p_message_id:messageId,p_confirmation:"PERMANENTLY_DELETE_MESSAGE"});if(deleted.error)throw deleted.error;
}
