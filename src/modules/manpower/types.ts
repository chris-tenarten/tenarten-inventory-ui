export type ManpowerReference = {
  id: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ManpowerJob = {
  id: string;
  name: string;
  job_number: string | null;
  production_status: import('../production/types').ProductionStatus;
  archived_at: string | null;
  active_rework_cycle?: ManpowerReworkCycle | null;
};

export type ManpowerReworkCycle = Pick<
  import('../production/types').ProductionReworkCycle,
  'id' | 'job_id' | 'sequence_number' | 'production_status'
>;

export type ManpowerWorkTarget =
  | { kind: 'job'; jobId: string }
  | { kind: 'rework'; jobId: string; reworkCycleId: string }
  | { kind: 'temporary'; label: string };

export type ManpowerReportingGroup = {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type ManpowerEntry = {
  id: string;
  work_date: string;
  worker_id: string;
  task_id: string;
  job_id: string | null;
  rework_cycle_id: string | null;
  reporting_group_id: string | null;
  unlisted_work_label: string | null;
  am_hours: number;
  pm_hours: number;
  notes: string | null;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
  worker: Pick<ManpowerReference, 'id' | 'display_name'>;
  task: Pick<ManpowerReference, 'id' | 'display_name'>;
  job: ManpowerJob | null;
  rework_cycle: ManpowerReworkCycle | null;
  reporting_group: ManpowerReportingGroup | null;
};

export type ManpowerEntryInput = {
  work_date: string;
  worker_id: string;
  task_id: string;
  job_id: string | null;
  rework_cycle_id: string | null;
  reporting_group_id: string | null;
  unlisted_work_label: string | null;
  am_hours: number;
  pm_hours: number;
  notes: string | null;
};
