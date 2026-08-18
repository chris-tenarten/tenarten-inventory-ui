import { supabase } from '../../lib/supabase';

import type {
  JobAttachment,
  JobDocumentType,
  JobUpdate,
  NewProductionJob,
  ProductionJob,
  ProductionReworkCycle,
  ReworkReasonCategory,
} from './types';
import {
  summarizeJobUpdates,
  type JobUpdateSummary,
} from './job-update-summary';

export { EMPTY_JOB_UPDATE_SUMMARY, type JobUpdateSummary } from './job-update-summary';
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
  'job_update_id',
  'job_update_attachment_role',
  'created_at',
].join(',');

const JOB_UPDATE_COLUMNS = [
  'id',
  'job_id',
  'author_name',
  'body',
  'requires_follow_up',
  'follow_up_assignee_name',
  'resolved_at',
  'resolved_by_name',
  'resolution_message',
  'edited_at',
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
    | 'contract_value'
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

export async function loadProductionJobs(includeArchived = false): Promise<ProductionJob[]> {
  let query = supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .order('planned_start', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (!includeArchived) query = query.is('archived_at', null);
  const [{ data, error }, reworks] = await Promise.all([
    query,
    supabase.from('production_rework_cycles').select('*').order('sequence_number', { ascending: false }),
  ]);

  if (error) throw error;
  if (reworks.error) throw reworks.error;
  const activeByJob = new Map<string, ProductionReworkCycle>();
  for (const cycle of (reworks.data ?? []) as ProductionReworkCycle[]) {
    if (!['complete', 'cancelled'].includes(cycle.production_status) && !activeByJob.has(cycle.job_id)) {
      activeByJob.set(cycle.job_id, cycle);
    }
  }
  return ((data ?? []) as unknown as ProductionJob[]).map((job) => {
    const cycle = activeByJob.get(job.id);
    if (!cycle) return { ...job, lifecycle_key: `original:${job.id}`, rework_cycle: null };
    return {
      ...job,
      lifecycle_key: `rework:${cycle.id}`,
      rework_cycle: cycle,
      original_production_status: job.production_status,
      original_planned_start: job.planned_start,
      original_planned_end: job.planned_end,
      original_updated_at: job.updated_at,
      production_status: cycle.production_status,
      planned_start: cycle.planned_start,
      planned_end: cycle.planned_end,
      updated_at: cycle.updated_at,
    };
  });
}

export async function loadProductionReworkCycles(jobId: string): Promise<ProductionReworkCycle[]> {
  const { data, error } = await supabase.from('production_rework_cycles').select('*').eq('job_id', jobId).order('sequence_number', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProductionReworkCycle[];
}

export async function createProductionRework(input: {
  jobId: string;
  reasonCategory: ReworkReasonCategory;
  scopeDetails: string;
  intakeDate: string;
  createdBy: string | null;
}): Promise<ProductionReworkCycle> {
  const { data, error } = await supabase.rpc('create_production_rework', {
    p_job_id: input.jobId,
    p_reason_category: input.reasonCategory,
    p_scope_details: input.scopeDetails,
    p_intake_date: input.intakeDate,
    p_created_by: input.createdBy,
  });
  if (error) throw error;
  return data as ProductionReworkCycle;
}

export async function saveProductionReworkScheduleBatch(args: {
  p_proposals: Array<{ rework_cycle_id: string; original_planned_start: string | null; original_planned_end: string | null; original_updated_at: string; proposed_planned_start: string | null; proposed_planned_end: string | null; change_source: string }>;
  p_changed_by: string;
  p_change_note: string | null;
  p_batch_id: string;
}) {
  const { data, error } = await supabase.rpc('save_production_rework_schedule_batch', args);
  if (error) throw error;
  return data as { updated_count: number; updated_reworks: ProductionReworkCycle[] };
}

export async function saveProductionReworkMixedScheduleBatch(args: {
  p_job_proposals: unknown[];
  p_phase_proposals: unknown[];
  p_rework_proposals: unknown[];
  p_changed_by: string;
  p_change_note: string | null;
  p_batch_id: string;
}) {
  const { data, error } = await supabase.rpc('save_production_rework_mixed_schedule_batch', args);
  if (error) throw error;
  return data as { updated_count: number; updated_jobs: import('./schedule-batch-contract').ProductionScheduleBatchUpdatedJob[]; updated_phases: import('@/modules/planning/types').PlanningPhase[]; updated_reworks: ProductionReworkCycle[] };
}

export async function updateProductionReworkStatus(cycleId: string, status: ProductionJob['production_status'], expectedUpdatedAt: string, actorName: string | null) {
  const { data, error } = await supabase.rpc('update_production_rework_status', {
    p_rework_cycle_id: cycleId,
    p_production_status: status,
    p_expected_updated_at: expectedUpdatedAt,
    p_actor_name: actorName,
  });
  if (error) throw error;
  return data as ProductionReworkCycle;
}

export type ProductionIntegrationSummary = { actualHours: number; laborEntryCount: number; materialReportDates: string[] };
export async function loadJobUpdateSummaries(): Promise<Record<string, JobUpdateSummary>> {
  const { data, error } = await supabase
    .from('job_updates')
    .select('job_id,created_at,requires_follow_up,resolved_at,follow_up_assignee_name');
  if (error) throw error;

  const grouped: Record<string, typeof data> = {};
  for (const row of data ?? []) {
    const jobId = String(row.job_id);
    grouped[jobId] = [...(grouped[jobId] ?? []), row];
  }
  return Object.fromEntries(
    Object.entries(grouped).map(([jobId, rows]) => [
      jobId,
      summarizeJobUpdates(rows ?? []),
    ]),
  );
}

export async function loadProductionIntegrationSummaries(): Promise<Record<string, ProductionIntegrationSummary>> {
  const [labor, materials] = await Promise.all([
    supabase.from('manpower_entries').select('job_id,am_hours,pm_hours').not('job_id', 'is', null),
    supabase.from('material_usage_reports').select('job_id,report_date').not('job_id', 'is', null),
  ]);
  if (labor.error) throw labor.error;
  if (materials.error) throw materials.error;
  const summaries: Record<string, ProductionIntegrationSummary> = {};
  for (const row of labor.data ?? []) { const id = String(row.job_id); summaries[id] ??= { actualHours: 0, laborEntryCount: 0, materialReportDates: [] }; summaries[id].actualHours += Number(row.am_hours ?? 0) + Number(row.pm_hours ?? 0); summaries[id].laborEntryCount += 1; }
  for (const row of materials.data ?? []) { const id = String(row.job_id); summaries[id] ??= { actualHours: 0, laborEntryCount: 0, materialReportDates: [] }; summaries[id].materialReportDates.push(String(row.report_date)); }
  return summaries;
}

export async function archiveProductionJob(job: ProductionJob): Promise<ProductionJob> {
  if (job.rework_cycle) throw new Error('Complete or cancel the active Rework before archiving this Production Job.');
  if (!['complete', 'shipped', 'cancelled'].includes(job.production_status)) throw new Error('Only Complete, Shipped, or Cancelled jobs can be archived.');
  const archivedAt = new Date().toISOString();
  const { data, error } = await supabase.from('jobs').update({ archived_at: archivedAt }).eq('id', job.id).is('archived_at', null).select(JOB_COLUMNS).single();
  if (error) throw error;
  await supabase.from('job_activity').insert({ job_id: job.id, event_type: 'job_archived', summary: `Job archived: ${job.name}`, metadata: { archived_at: archivedAt } });
  return data as unknown as ProductionJob;
}

export async function restoreProductionJob(job: ProductionJob): Promise<ProductionJob> {
  if (!job.archived_at) throw new Error('Only archived jobs can be restored.');
  const { data, error } = await supabase.from('jobs').update({ archived_at: null }).eq('id', job.id).not('archived_at', 'is', null).select(JOB_COLUMNS).single();
  if (error) throw error;
  const { error: activityError } = await supabase.from('job_activity').insert({ job_id: job.id, event_type: 'job_restored', summary: `Job restored: ${job.name}`, metadata: { previous_archived_at: job.archived_at } });
  if (activityError) console.error('Job restored, but activity logging failed:', activityError);
  return data as unknown as ProductionJob;
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
  if (currentJob.rework_cycle && changes.production_status) {
    if (Object.keys(changes).length > 1) {
      throw new Error('Save job-detail changes separately before changing the Rework Production status.');
    }
    const status = changes.production_status;
    const updatedCycle = await updateProductionReworkStatus(currentJob.rework_cycle.id, status, currentJob.rework_cycle.updated_at, null);
    return { ...currentJob, production_status: updatedCycle.production_status, updated_at: updatedCycle.updated_at, rework_cycle: updatedCycle };
  }
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

export async function saveProductionPlanningScheduleBatch(args: import('./schedule-batch-contract').MixedScheduleBatchRpcArgs): Promise<import('./schedule-batch-contract').MixedScheduleBatchSuccess> {
  const { data, error } = await supabase.rpc('save_production_planning_schedule_batch', args);
  if (error) throw error;
  return data as import('./schedule-batch-contract').MixedScheduleBatchSuccess;
}

export type ProductionJobActivity = { id: string; event_type: string; summary: string; actor_name: string | null; metadata: Record<string, unknown>; occurred_at: string };

export async function loadProductionJobActivity(jobId: string): Promise<ProductionJobActivity[]> {
  const { data, error } = await supabase.from('job_activity').select('id,event_type,summary,actor_name,metadata,occurred_at').eq('job_id', jobId).order('occurred_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as ProductionJobActivity[];
}

export async function loadJobUpdates(jobId: string): Promise<JobUpdate[]> {
  const { data, error } = await supabase
    .from('job_updates')
    .select(JOB_UPDATE_COLUMNS)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as JobUpdate[];
}

export async function createJobUpdate(
  jobId: string,
  authorName: string,
  body: string,
  requiresFollowUp: boolean,
  followUpAssigneeName: string | null,
): Promise<JobUpdate> {
  const author = authorName.trim();
  const updateBody = body.trim();
  if (!author) throw new Error('Your name is required.');
  if (!updateBody) throw new Error('Enter an update before posting.');
  const assignee = followUpAssigneeName?.trim() || null;
  if (requiresFollowUp && !assignee) {
    throw new Error('Select who needs to resolve this update.');
  }

  const { data, error } = await supabase
    .from('job_updates')
    .insert({
      job_id: jobId,
      author_name: author,
      body: updateBody,
      requires_follow_up: requiresFollowUp,
      follow_up_assignee_name: requiresFollowUp ? assignee : null,
    })
    .select(JOB_UPDATE_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as JobUpdate;
}

export async function editJobUpdate(
  updateId: string,
  body: string,
  requiresFollowUp: boolean,
  followUpAssigneeName: string | null,
): Promise<JobUpdate> {
  const updateBody = body.trim();
  if (!updateBody) throw new Error('Enter an update before saving.');
  const assignee = followUpAssigneeName?.trim() || null;
  if (requiresFollowUp && !assignee) {
    throw new Error('Select who needs to resolve this update.');
  }

  const { data, error } = await supabase.rpc('edit_job_update', {
    p_update_id: updateId,
    p_body: updateBody,
    p_requires_follow_up: requiresFollowUp,
    p_follow_up_assignee_name: requiresFollowUp ? assignee : null,
  });

  if (error) throw error;
  return data as unknown as JobUpdate;
}

export async function resolveJobUpdate(
  update: JobUpdate,
  resolverName: string,
  resolutionMessage: string,
): Promise<JobUpdate> {
  const resolver = resolverName.trim();
  if (!resolver) throw new Error('Resolver name is required.');
  if (!update.requires_follow_up) {
    throw new Error('Only follow-up updates can be resolved.');
  }

  const { data, error } = await supabase.rpc('resolve_job_update', {
    p_update_id: update.id,
    p_resolved_by_name: resolver,
    p_resolution_message: resolutionMessage.trim() || null,
  });

  if (error) throw error;
  return data as unknown as JobUpdate;
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
  jobUpdateId: string | null = null,
  uploadedBy: string | null = null,
  jobUpdateAttachmentRole: 'update' | 'resolution' | null =
    jobUpdateId ? 'update' : null,
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
        job_update_id: jobUpdateId,
        job_update_attachment_role: jobUpdateAttachmentRole,
        uploaded_by: uploadedBy?.trim() || null,
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
