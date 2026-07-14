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
};

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
  reporting_group: ManpowerReportingGroup | null;
};

export type ManpowerEntryInput = {
  work_date: string;
  worker_id: string;
  task_id: string;
  job_id: string | null;
  reporting_group_id: string | null;
  unlisted_work_label: string | null;
  am_hours: number;
  pm_hours: number;
  notes: string | null;
};
