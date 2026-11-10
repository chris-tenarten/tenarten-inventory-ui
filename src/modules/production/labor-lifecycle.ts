export type LaborLifecycleRow = {
  job_id: string | null;
  rework_cycle_id: string | null;
  am_hours: number | string | null;
  pm_hours: number | string | null;
  rework_cycle?: { id: string; sequence_number: number } | Array<{ id: string; sequence_number: number }> | null;
};

export type LaborLifecycleBreakdown = {
  reworkCycleId: string;
  sequenceNumber: number;
  hours: number;
  entryCount: number;
};

export type JobLaborLifecycleSummary = {
  jobId: string;
  totalHours: number;
  entryCount: number;
  originalOrUnclassifiedHours: number;
  originalOrUnclassifiedEntryCount: number;
  reworks: LaborLifecycleBreakdown[];
};

function relatedCycle(row: LaborLifecycleRow) {
  return Array.isArray(row.rework_cycle) ? row.rework_cycle[0] : row.rework_cycle;
}

export function summarizeLaborLifecycles(rows: LaborLifecycleRow[]) {
  const summaries = new Map<string, JobLaborLifecycleSummary>();
  const reworksByJob = new Map<string, Map<string, LaborLifecycleBreakdown>>();
  for (const row of rows) {
    if (!row.job_id) continue;
    const jobId = String(row.job_id);
    const hours = Number(row.am_hours ?? 0) + Number(row.pm_hours ?? 0);
    const summary = summaries.get(jobId) ?? {
      jobId,
      totalHours: 0,
      entryCount: 0,
      originalOrUnclassifiedHours: 0,
      originalOrUnclassifiedEntryCount: 0,
      reworks: [],
    };
    summary.totalHours += hours;
    summary.entryCount += 1;
    if (!row.rework_cycle_id) {
      summary.originalOrUnclassifiedHours += hours;
      summary.originalOrUnclassifiedEntryCount += 1;
    } else {
      const cycle = relatedCycle(row);
      const jobReworks = reworksByJob.get(jobId) ?? new Map<string, LaborLifecycleBreakdown>();
      const rework = jobReworks.get(row.rework_cycle_id) ?? {
        reworkCycleId: row.rework_cycle_id,
        sequenceNumber: cycle?.sequence_number ?? 0,
        hours: 0,
        entryCount: 0,
      };
      rework.hours += hours;
      rework.entryCount += 1;
      jobReworks.set(row.rework_cycle_id, rework);
      reworksByJob.set(jobId, jobReworks);
    }
    summaries.set(jobId, summary);
  }
  for (const [jobId, summary] of summaries) {
    summary.reworks = [...(reworksByJob.get(jobId)?.values() ?? [])]
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber || a.reworkCycleId.localeCompare(b.reworkCycleId));
  }
  return summaries;
}
