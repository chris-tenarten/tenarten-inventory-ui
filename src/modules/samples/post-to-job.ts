import { supabase } from '@/lib/supabase';
import type { JobDocumentType, JobUpdate } from '@/modules/production/types';
export type PublishJob = { id: string; name: string; customer: string | null; job_number: string | null };
export async function searchPublishJobs(search: string): Promise<PublishJob[]> {
  const { data, error } = await supabase.rpc('search_sample_update_jobs', { p_search: search.trim().slice(0, 120) });
  if (error) throw error;
  return (data ?? []) as PublishJob[];
}
export async function postSampleToJob(input: { jobId: string; requestId: string; file: File; documentType: JobDocumentType; body: string; mentionedUserIds: string[] }): Promise<JobUpdate> {
  const { jobId, requestId, file } = input;
  const permitted = await supabase.rpc('can_publish_sample_to_job', { p_job_id: jobId });
  if (permitted.error) throw permitted.error;
  if (!permitted.data) throw new Error('You do not have permission to post a document to this Job.');
  const path = `${jobId}/sample-updates/${requestId}.pdf`;
  const uploaded = await supabase.storage.from('job-attachments').upload(path, file, { contentType: 'application/pdf', upsert: false });
  // Only an existing object is retryable without uploading. Network/other errors
  // remain failures; the same request ID lets the next attempt safely recover.
  if (uploaded.error && !['409', 'Duplicate'].includes(String(uploaded.error.statusCode)) && !/already exists|duplicate/i.test(uploaded.error.message)) throw uploaded.error;
  const { data, error } = await supabase.rpc('publish_sample_job_update', {
    p_job_id: jobId, p_request_id: requestId, p_filename: file.name, p_size_bytes: file.size,
    p_document_type: input.documentType, p_body: input.body, p_mentioned_user_ids: input.mentionedUserIds,
  });
  if (error) {
    // A PostgreSQL rejection proves the transaction rolled back. Transport
    // failures may hide a committed Update: keep bytes and retry the same ID.
    if (/^(22|23|42|P0)/.test(error.code ?? '')) {
      const existing = await supabase.from('job_attachments').select('id').eq('storage_path', path).maybeSingle();
      if (existing.error || existing.data) throw new Error(`${error.message} Retry this same post to recover safely.`);
      const cleanup = await supabase.storage.from('job-attachments').remove([path]);
      if (cleanup.error) throw new Error('Update was not posted. Upload cleanup failed; retry this same post or contact an administrator.');
    }
    throw new Error(`${error.message} Retry this same post to recover safely.`);
  }
  return data as JobUpdate;
}
