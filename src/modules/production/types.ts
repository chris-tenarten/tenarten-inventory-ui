export type ProductionStatus =
  | 'not_started'
  | 'on_deck'
  | 'in_production'
  | 'on_hold'
  | 'shipped'
  | 'complete'
  | 'cancelled';

export type MaterialStatus = 'unknown' | 'not_ready' | 'ordered' | 'ready';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ReworkReasonCategory =
  | 'quality_qc'
  | 'shipping_handling'
  | 'customer_change'
  | 'other';

export type ProductionReworkCycle = {
  id: string;
  job_id: string;
  sequence_number: number;
  reason_category: ReworkReasonCategory;
  scope_details: string;
  intake_date: string;
  planned_start: string | null;
  planned_end: string | null;
  production_status: ProductionStatus;
  completed_at: string | null;
  created_by: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JobDocumentType =
  | 'estimate'
  | 'work_order'
  | 'blend_sheet'
  | 'shop_drawing'
  | 'cut_ticket'
  | 'color_plate'
  | 'sample_approval'
  | 'purchase_order'
  | 'photo'
  | 'other';

export type ProductionJob = {
  id: string;
  name: string;
  customer: string | null;
  job_number: string | null;
  estimate_number: string | null;
  work_order_number: string | null;
  contract_value: number | null;
  deposit_date: string | null;
  color_plate_number: string | null;
  sample_submitted_date: string | null;
  approval_date: string | null;
  resin_po: string | null;
  chip_po: string | null;
  estimated_man_hours: number | null;
  estimated_calendar_days: number | null;
  requested_delivery_date: string | null;
  planned_start: string | null;
  planned_end: string | null;
  production_status: ProductionStatus;
  material_status: MaterialStatus;
  priority: JobPriority;
  progress_percent: number;
  owner_name: string | null;
  remarks: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  lifecycle_key?: `original:${string}` | `rework:${string}`;
  rework_cycle?: ProductionReworkCycle | null;
  original_production_status?: ProductionStatus;
  original_planned_start?: string | null;
  original_planned_end?: string | null;
  original_updated_at?: string;
};

export type NewProductionJob = {
  name: string;
  customer: string | null;
  job_number: string | null;
  estimate_number: string | null;
  work_order_number: string | null;
  deposit_date: string | null;
  color_plate_number: string | null;
  sample_submitted_date: string | null;
  approval_date: string | null;
  estimated_man_hours: number | null;
  estimated_calendar_days: number | null;
  requested_delivery_date: string | null;
  planned_start: string | null;
  planned_end: string | null;
  remarks: string | null;
};

export type JobAttachment = {
  id: string;
  job_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  document_type: JobDocumentType;
  uploaded_by: string | null;
  job_update_id: string | null;
  job_update_attachment_role: "update" | "resolution" | null;
  created_at: string;
};

export type JobUpdate = {
  id: string;
  job_id: string;
  author_name: string;
  body: string;
  requires_follow_up: boolean;
  follow_up_assignee_name: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolution_message: string | null;
  edited_at: string | null;
  created_at: string;
};
