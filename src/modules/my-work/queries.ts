import {supabase} from '@/lib/supabase';
import {loadProductionJobOptions} from '@/modules/production/job-options';
import type {WorkCollaborator,WorkJob,WorkTask,WorkTaskAttachment,WorkTaskColor} from './types';

type TaskRow={id:string;title:string;notes:string;visibility:'private'|'shared';creator_user_id:string;creator_name:string;assignee_user_id:string;assignee_name:string;due_date:string|null;context_type:string|null;context_id:string|null;job_number:string|null;job_name:string|null;job_customer:string|null;color_key:WorkTaskColor;completed_at:string|null;created_at:string;updated_at:string};
export async function loadMyWorkTasks():Promise<WorkTask[]>{
  const{data,error}=await supabase.rpc('list_my_work_tasks');if(error)throw error;return((data??[]) as TaskRow[]).map(row=>({id:row.id,title:row.title,notes:row.notes||'',visibility:row.visibility,creatorUserId:row.creator_user_id,creatorName:row.creator_name||'TenOps user',assigneeUserId:row.assignee_user_id,assigneeName:row.assignee_name||'TenOps user',dueDate:row.due_date||'',contextType:row.context_type||'',contextId:row.context_id||'',jobNumber:row.job_number||'',jobName:row.job_name||'',jobCustomer:row.job_customer||'',color:row.color_key||'neutral',attachmentCount:0,completedAt:row.completed_at||'',createdAt:row.created_at,updatedAt:row.updated_at}));
}
export async function loadWorkTaskAttachmentCounts(){const{data,error}=await supabase.from('work_task_attachments').select('task_id');if(error)throw error;const counts=new Map<string,number>();for(const attachment of data??[])counts.set(attachment.task_id,(counts.get(attachment.task_id)??0)+1);return counts;}
export async function loadWorkCollaborators():Promise<WorkCollaborator[]>{const{data,error}=await supabase.rpc('list_my_work_inbox_recipients');if(error)throw error;return((data??[]) as Array<{user_id:string;display_name:string;role:string}>).map(row=>({userId:row.user_id,displayName:row.display_name,role:row.role}));}
export async function loadWorkJobs():Promise<WorkJob[]>{return(await loadProductionJobOptions()).map(job=>({id:job.id,jobNumber:job.job_number||'',name:job.name||'',customer:job.customer||''}));}
export async function createWorkTask(input:{title:string;assigneeUserId?:string;dueDate?:string;jobId?:string;notes?:string;color?:WorkTaskColor}){const{data,error}=await supabase.rpc('create_my_work_task_complete',{p_title:input.title,p_assignee_user_id:input.assigneeUserId||null,p_due_date:input.dueDate||null,p_context_type:input.jobId?'job':null,p_context_id:input.jobId||null,p_notes:input.notes||'',p_color_key:input.color||'neutral'});if(error)throw error;return String(data);}
export async function updateWorkTask(input:{id:string;title:string;notes:string;assigneeUserId:string;dueDate:string;jobId:string;color:WorkTaskColor}){const{error}=await supabase.rpc('update_my_work_task',{p_task_id:input.id,p_title:input.title,p_notes:input.notes,p_assignee_user_id:input.assigneeUserId,p_due_date:input.dueDate||null,p_context_type:input.jobId?'job':null,p_context_id:input.jobId||null,p_color_key:input.color});if(error)throw error;}
export async function setWorkTaskCompleted(id:string,completed:boolean){const{error}=await supabase.rpc('set_my_work_task_completed',{p_task_id:id,p_completed:completed});if(error)throw error;}
export async function loadMyOpenTaskCountForJob(jobId:string){const{count,error}=await supabase.from('work_tasks').select('id',{count:'exact',head:true}).eq('context_type','job').eq('context_id',jobId).is('completed_at',null);if(error)throw error;return count??0;}

const ATTACHMENT_BUCKET='my-work-attachments';
type AttachmentRow={id:string;task_id:string;uploader_user_id:string;storage_path:string;original_filename:string;content_type:string;byte_size:number;created_at:string};
const mapAttachment=(row:AttachmentRow):WorkTaskAttachment=>({id:row.id,taskId:row.task_id,uploaderUserId:row.uploader_user_id,storagePath:row.storage_path,originalFilename:row.original_filename,contentType:row.content_type,byteSize:Number(row.byte_size),createdAt:row.created_at});
export async function loadWorkTaskAttachments(taskId:string):Promise<WorkTaskAttachment[]>{const{data,error}=await supabase.from('work_task_attachments').select('id,task_id,uploader_user_id,storage_path,original_filename,content_type,byte_size,created_at').eq('task_id',taskId).order('created_at').order('id');if(error)throw error;return((data??[]) as AttachmentRow[]).map(mapAttachment);}
const safeFilename=(name:string)=>name.normalize('NFKC').replace(/[^a-zA-Z0-9._ -]+/g,'_').replace(/\s+/g,' ').trim().slice(0,180)||'attachment';
export async function uploadWorkTaskAttachments(taskId:string,files:File[],onStage?:(stage:'uploading'|'associating')=>void):Promise<WorkTaskAttachment[]>{
  const{data:userData,error:userError}=await supabase.auth.getUser();if(userError||!userData.user)throw userError??new Error('Sign in is required to upload attachments.');
  const uploaded:WorkTaskAttachment[]=[];
  for(const file of files){
    if(file.size>26214400)throw new Error(`${file.name} exceeds the 25 MB attachment limit.`);
    const id=crypto.randomUUID();const storagePath=`${taskId}/${id}/${safeFilename(file.name)}`;const contentType=file.type||'application/octet-stream';
    onStage?.('uploading');const stored=await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath,file,{contentType,upsert:false});if(stored.error)throw stored.error;
    onStage?.('associating');
    const{data,error}=await supabase.from('work_task_attachments').insert({id,task_id:taskId,uploader_user_id:userData.user.id,storage_path:storagePath,original_filename:file.name,content_type:contentType,byte_size:file.size}).select('id,task_id,uploader_user_id,storage_path,original_filename,content_type,byte_size,created_at').single();
    if(error){await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);throw error;}uploaded.push(mapAttachment(data as AttachmentRow));
  }
  return uploaded;
}
export async function finalizeWorkTaskCreation(taskId:string,attachmentCount:number){const{error}=await supabase.rpc('finalize_my_work_task_creation',{p_task_id:taskId,p_expected_attachment_count:attachmentCount});if(error)throw error;}
export async function openWorkTaskAttachment(attachment:WorkTaskAttachment){const{data,error}=await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(attachment.storagePath,600);if(error)throw error;const link=document.createElement('a');link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.download=attachment.originalFilename;document.body.append(link);link.click();link.remove();}
export async function removeWorkTaskAttachment(attachment:WorkTaskAttachment){const removed=await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.storagePath]);if(removed.error)throw removed.error;const{error}=await supabase.from('work_task_attachments').delete().eq('id',attachment.id);if(error)throw error;}
export async function permanentlyDeleteWorkTask(taskId:string){const prepared=await supabase.rpc('prepare_admin_delete_work_task',{p_task_id:taskId});if(prepared.error)throw prepared.error;const paths=((prepared.data??[]) as Array<{storage_path:string}>).map(row=>row.storage_path);if(paths.length){const removed=await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);if(removed.error)throw removed.error;}const deleted=await supabase.rpc('admin_permanently_delete_work_task',{p_task_id:taskId,p_confirmation:'PERMANENTLY_DELETE_TASK'});if(deleted.error)throw deleted.error;}
