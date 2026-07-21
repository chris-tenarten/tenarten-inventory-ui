import { supabase } from '@/lib/supabase';
import type { ProductionJob } from './types';
import { loadProductionJobs } from './jobs';
import { last30Days, type SnapshotPeriod } from './snapshot-period';

export type RankedValue = { label: string; value: number; jobId?: string; jobNumber?: string | null };
export type SnapshotActivity = { label: string; count: number };
export type SnapshotAttention = { job: ProductionJob; issue: string; focus?: string };
export type SnapshotData = {
  period: SnapshotPeriod;
  jobs: ProductionJob[];
  transitionJobIds: { started: Set<string>; completed: Set<string>; shipped: Set<string> };
  jobsDeliveredLate: number;
  reportedHours: number;
  reportingDays: number;
  laborJobCount: number;
  laborJobIds: Set<string>;
  linkedLaborJobIds: Set<string>;
  topLaborJobs: RankedValue[];
  topWorkers: RankedValue[];
  topTasks: RankedValue[];
  dailyLabor: Array<{ date: string; hours: number }>;
  materialReportCount: number;
  materialJobIds: Set<string>;
  linkedMaterialJobIds: Set<string>;
  topMaterialsByFrequency: RankedValue[];
  topMaterialsByQuantity: RankedValue[];
  receivalsCompleted: number;
  inventoryCounts: Record<'intake' | 'outtake' | 'adjustment', number>;
  activeMaterials: SnapshotActivity[];
  unresolvedReceivals: Array<{ id: string; material: string; vendor: string | null; eta: string | null; createdAt: string | null }>;
};

function rank(map: Map<string, number>, limit = 5): RankedValue[] {
  return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, limit);
}

function statusTransition(metadata: Record<string, unknown> | null | undefined) {
  const changes = metadata?.new_values as Record<string, unknown> | undefined;
  return typeof changes?.production_status === 'string' ? changes.production_status : null;
}

export async function loadMonthlySnapshot(now = new Date()): Promise<SnapshotData> {
  const period = last30Days(now);
  const startInstant = `${period.start}T00:00:00`;
  const endInstant = `${period.end}T23:59:59.999`;
  const [jobs, activity, labor, laborLinks, reports, materialLinks, transactions, completedReceivals, unresolved] = await Promise.all([
    loadProductionJobs(true),
    supabase.from('job_activity').select('job_id,event_type,metadata,occurred_at').gte('occurred_at', startInstant).lte('occurred_at', endInstant),
    supabase.from('manpower_entries').select('job_id,work_date,am_hours,pm_hours,worker:manpower_workers(display_name),task:manpower_tasks(display_name)').gte('work_date', period.start).lte('work_date', period.end),
    supabase.from('manpower_entries').select('job_id').not('job_id', 'is', null),
    supabase.from('material_usage_reports').select('id,job_id,report_date,material_usage_lines(material_name,quantity,unit)').gte('report_date', period.start).lte('report_date', period.end),
    supabase.from('material_usage_reports').select('job_id').not('job_id', 'is', null),
    supabase.from('inventory_transactions').select('transaction_type,item_name,created_at').gte('created_at', startInstant).lte('created_at', endInstant),
    supabase.from('pending_receivals').select('id,received_at').gte('received_at', startInstant).lte('received_at', endInstant),
    supabase.from('pending_receivals').select('id,material_name,vendor,eta,created_at,status').in('status', ['pending', 'partially_received']).order('created_at', { ascending: true }).limit(8),
  ]);
  for (const result of [activity, labor, laborLinks, reports, materialLinks, transactions, completedReceivals, unresolved]) if (result.error) throw result.error;

  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const transitionJobIds = { started: new Set<string>(), completed: new Set<string>(), shipped: new Set<string>() };
  const jobsDeliveredLate = new Set<string>();
  for (const row of activity.data ?? []) {
    const status = statusTransition(row.metadata as Record<string, unknown>);
    if (status === 'in_production') transitionJobIds.started.add(String(row.job_id));
    if (status === 'complete') transitionJobIds.completed.add(String(row.job_id));
    if (status === 'shipped') {
      const id = String(row.job_id);
      transitionJobIds.shipped.add(id);
      const requested = jobById.get(id)?.requested_delivery_date;
      if (requested && requested < String(row.occurred_at).slice(0, 10)) jobsDeliveredLate.add(id);
    }
  }

  let reportedHours = 0;
  const reportingDays = new Set<string>();
  const laborJobIds = new Set<string>();
  const laborJobs = new Map<string, number>();
  const workers = new Map<string, number>();
  const tasks = new Map<string, number>();
  const dailyLabor = new Map<string, number>();
  for (const row of labor.data ?? []) {
    const hours = Number(row.am_hours ?? 0) + Number(row.pm_hours ?? 0);
    reportedHours += hours;
    reportingDays.add(String(row.work_date));
    dailyLabor.set(String(row.work_date), (dailyLabor.get(String(row.work_date)) ?? 0) + hours);
    if (row.job_id) {
      const id = String(row.job_id); laborJobIds.add(id);
      laborJobs.set(id, (laborJobs.get(id) ?? 0) + hours);
    }
    const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
    const task = Array.isArray(row.task) ? row.task[0] : row.task;
    const workerName = worker?.display_name || 'Unknown worker';
    const taskName = task?.display_name || 'Unknown task';
    workers.set(workerName, (workers.get(workerName) ?? 0) + hours);
    tasks.set(taskName, (tasks.get(taskName) ?? 0) + hours);
  }

  const materialJobIds = new Set<string>();
  const linkedMaterialJobIds = new Set((materialLinks.data ?? []).map((row) => String(row.job_id)));
  const linkedLaborJobIds = new Set((laborLinks.data ?? []).map((row) => String(row.job_id)));
  const materialFrequency = new Map<string, number>();
  const materialQuantity = new Map<string, number>();
  for (const report of reports.data ?? []) {
    if (report.job_id) materialJobIds.add(String(report.job_id));
    for (const line of report.material_usage_lines ?? []) {
      const name = line.material_name?.trim();
      if (!name) continue;
      materialFrequency.set(name, (materialFrequency.get(name) ?? 0) + 1);
      const quantityLabel = line.unit?.trim() ? `${name} (${line.unit.trim()})` : name;
      materialQuantity.set(quantityLabel, (materialQuantity.get(quantityLabel) ?? 0) + Number(line.quantity ?? 0));
    }
  }

  const inventoryCounts = { intake: 0, outtake: 0, adjustment: 0 };
  const materialActivity = new Map<string, number>();
  for (const row of transactions.data ?? []) {
    const type = String(row.transaction_type ?? '');
    if (type === 'intake' || type === 'outtake' || type === 'adjustment') inventoryCounts[type] += 1;
    const item = row.item_name?.trim(); if (item) materialActivity.set(item, (materialActivity.get(item) ?? 0) + 1);
  }

  return {
    period, jobs, transitionJobIds, jobsDeliveredLate: jobsDeliveredLate.size, reportedHours, reportingDays: reportingDays.size, laborJobCount: laborJobIds.size, laborJobIds, linkedLaborJobIds,
    topLaborJobs: rank(laborJobs).map((row) => { const job = jobById.get(row.label); return { ...row, label: job ? `${job.job_number ? `${job.job_number} — ` : ''}${job.name}` : 'Unlinked job', jobId: job?.id, jobNumber: job?.job_number }; }), topWorkers: rank(workers), topTasks: rank(tasks),
    dailyLabor: Array.from({ length: 30 }, (_, index) => { const date = new Date(`${period.start}T12:00:00`); date.setDate(date.getDate() + index); const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; return { date: key, hours: dailyLabor.get(key) ?? 0 }; }),
    materialReportCount: reports.data?.length ?? 0, materialJobIds, linkedMaterialJobIds, topMaterialsByFrequency: rank(materialFrequency), topMaterialsByQuantity: rank(materialQuantity),
    receivalsCompleted: completedReceivals.data?.length ?? 0, inventoryCounts, activeMaterials: rank(materialActivity).map(({ label, value }) => ({ label, count: value })),
    unresolvedReceivals: (unresolved.data ?? []).map((row) => ({ id: String(row.id), material: row.material_name, vendor: row.vendor, eta: row.eta, createdAt: row.created_at })),
  };
}
