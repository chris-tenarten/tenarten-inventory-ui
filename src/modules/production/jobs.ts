import { supabase } from '../../lib/supabase';

import type {
  JobAttachment,
  JobDocumentType,
  NewProductionJob,
  ProductionJob,
} from './types';
import { productionValuesEqual } from './update-normalization';
import type { ProductionScheduleBatchRpcArgs, ProductionScheduleBatchSuccess } from './schedule-batch-contract';

const JOB_COLUMNS = [
  'id',
  'name',
  'customer',
  'job_number',
  'estimate_number',
  'work_order_number',
  'contract_value',
  'deposit_date',
  'color_plate_number',
  'sample_submitted_date',
  'approval_date',
  'resin_po',
  'chip_po',
  'estimated_man_hours',
  'estimated_calendar_days',
  'requested_delivery_date',
  'planned_start',
  'planned_end',
  'production_status',
  'material_status',
  'priority',
  'progress_percent',
  'owner_name',
  'remarks',
  'archived_at',
  'created_at',
  'updated_at',
].join(',');

const ATTACHMENT_COLUMNS = [
  'id',
  'job_id',
  'file_name',
  'storage_path',
  'mime_type',
  'size_bytes',
  'document_type',
  'uploaded_by',
  'created_at',
].join(',');

export type ProductionJobUpdate = Partial<
  Pick<
    ProductionJob,
    | 'name'
    | 'customer'
    | 'job_number'
    | 'estimate_number'
    | 'work_order_number'
    | 'deposit_date'
    | 'color_plate_number'
    | 'sample_submitted_date'
    | 'approval_date'
    | 'estimated_man_hours'
    | 'estimated_calendar_days'
    | 'requested_delivery_date'
    | 'production_status'
    | 'material_status'
    | 'remarks'
  >
>;

export async function loadProductionJobs(): Promise<ProductionJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .is('archived_at', null)
    .order('planned_start', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ProductionJob[];
}

export async function createProductionJob(
  input: NewProductionJob,
): Promise<ProductionJob> {
  if (input.planned_start || input.planned_end) {
    throw new Error('Initial planned dates must use the guarded Production schedule workflow.');
  }
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      ...input,
      production_status: 'not_started',
      material_status: 'unknown',
      priority: 'normal',
      progress_percent: 0,
      owner_name: null,
      contract_value: null,
      resin_po: null,
      chip_po: null,
    })
    .select(JOB_COLUMNS)
    .single();

  if (error) throw error;

  const createdJob = data as unknown as ProductionJob;

  const { error: activityError } = await supabase.from('job_activity').insert({
    job_id: createdJob.id,
    event_type: 'job_created',
    summary: `Job created: ${createdJob.name}`,
    metadata: {
      customer: createdJob.customer,
      job_number: createdJob.job_number,
      planned_start: createdJob.planned_start,
      planned_end: createdJob.planned_end,
    },
  });

  if (activityError) {
    console.error('Job created, but activity logging failed:', activityError);
  }

  return createdJob;
}

export async function updateProductionJob(
  currentJob: ProductionJob,
  changes: ProductionJobUpdate,
): Promise<ProductionJob> {
  const effectiveChanges = Object.fromEntries(
    Object.entries(changes).filter(([field, value]) => (
      !productionValuesEqual(field as keyof ProductionJob, currentJob[field as keyof ProductionJob], value)
    )),
  ) as ProductionJobUpdate;
  const changedFields = Object.keys(effectiveChanges) as Array<keyof ProductionJobUpdate>;
  if (changedFields.length === 0) return currentJob;

  const { data, error } = await supabase
    .from('jobs')
    .update(effectiveChanges)
    .eq('id', currentJob.id)
    .select(JOB_COLUMNS)
    .single();

  if (error) throw error;

  const updatedJob = data as unknown as ProductionJob;

  const { error: activityError } = await supabase.from('job_activity').insert({
    job_id: currentJob.id,
    event_type: 'job_updated',
    summary: `Job updated: ${updatedJob.name}`,
    metadata: {
      changed_fields: changedFields,
      changes: effectiveChanges,
      old_values: Object.fromEntries(changedFields.map((field) => [field, currentJob[field]])),
      new_values: Object.fromEntries(changedFields.map((field) => [field, updatedJob[field]])),
    },
  });

  if (activityError) {
    console.error('Job updated, but activity logging failed:', activityError);
  }

  return updatedJob;
}

export async function saveProductionScheduleBatch(args: ProductionScheduleBatchRpcArgs): Promise<ProductionScheduleBatchSuccess> {
  const { data, error } = await supabase.rpc('save_production_schedule_batch', args);
  if (error) throw error;
  return data as ProductionScheduleBatchSuccess;
}

export type ProductionJobActivity = { id: string; event_type: string; summary: string; actor_name: string | null; metadata: Record<string, unknown>; occurred_at: string };

export async function loadProductionJobActivity(jobId: string): Promise<ProductionJobActivity[]> {
  const { data, error } = await supabase.from('job_activity').select('id,event_type,summary,actor_name,metadata,occurred_at').eq('job_id', jobId).order('occurred_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as ProductionJobActivity[];
}

export async function loadJobAttachmentCounts(): Promise<
  Record<string, number>
> {
  const { data, error } = await supabase.from('job_attachments').select('job_id');
  if (error) throw error;

  return (data ?? []).reduce<Record<string, number>>((counts, row) => {
    const jobId = String(row.job_id);
    counts[jobId] = (counts[jobId] ?? 0) + 1;
    return counts;
  }, {});
}

export async function loadJobAttachments(
  jobId: string,
): Promise<JobAttachment[]> {
  const { data, error } = await supabase
    .from('job_attachments')
    .select(ATTACHMENT_COLUMNS)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as JobAttachment[];
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export async function uploadJobAttachments(
  jobId: string,
  files: File[],
  documentType: JobDocumentType,
): Promise<JobAttachment[]> {
  const uploaded: JobAttachment[] = [];

  for (const file of files) {
    const storagePath = `${jobId}/${crypto.randomUUID()}-${safeFileName(
      file.name,
    )}`;

    const { error: storageError } = await supabase.storage
      .from('job-attachments')
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      });

    if (storageError) throw storageError;

    const { data, error: recordError } = await supabase
      .from('job_attachments')
      .insert({
        job_id: jobId,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
        document_type: documentType,
      })
      .select(ATTACHMENT_COLUMNS)
      .single();

    if (recordError) {
      await supabase.storage.from('job-attachments').remove([storagePath]);
      throw recordError;
    }

    uploaded.push(data as unknown as JobAttachment);
  }

  if (uploaded.length > 0) {
    const { error: activityError } = await supabase.from('job_activity').insert({
      job_id: jobId,
      event_type: 'attachments_uploaded',
      summary: `${uploaded.length} attachment${uploaded.length === 1 ? '' : 's'} uploaded`,
      metadata: {
        attachment_ids: uploaded.map((attachment) => attachment.id),
        file_names: uploaded.map((attachment) => attachment.file_name),
      },
    });

    if (activityError) {
      console.error('Attachments uploaded, but activity logging failed:', activityError);
    }
  }

  return uploaded;
}

export async function createJobAttachmentDownloadUrl(
  storagePath: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('job-attachments')
    .createSignedUrl(storagePath, 60 * 10);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteJobAttachment(
  attachment: JobAttachment,
): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('job-attachments')
    .remove([attachment.storage_path]);

  if (storageError) throw storageError;

  const { error: rowError } = await supabase
    .from('job_attachments')
    .delete()
    .eq('id', attachment.id);

  if (rowError) throw rowError;
}

export async function loadProductionJob(jobId: string): Promise<ProductionJob | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ProductionJob | null;
}
