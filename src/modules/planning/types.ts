export const planningStatuses = ["open", "planned", "in_progress", "waiting", "done"] as const;
export const planningCategories = ["internal", "customer", "vendor", "logistics", "blocker", "reference"] as const;
export const timelineBehaviors = ["overlay", "pause", "planning_only"] as const;
export const MAX_PLANNING_PHASES = 4;
export const planningTimelineColors = ["steel_blue", "industrial_teal", "muted_violet", "ochre_gold", "slate", "rust", "sage", "deep_cyan"] as const;
export type PlanningStatus = (typeof planningStatuses)[number];
export type PlanningCategory = (typeof planningCategories)[number];
export type TimelineBehavior = (typeof timelineBehaviors)[number];
export type PlanningTimelineColor = (typeof planningTimelineColors)[number];

export const countsTowardPlanningPhaseLimit = (behavior: TimelineBehavior) => behavior !== "pause";

export type PlanningPhase = {
  id: string;
  job_id: string;
  title: string;
  description: string;
  owner: string | null;
  category: PlanningCategory;
  status: PlanningStatus;
  start_date: string | null;
  end_date: string | null;
  timeline_behavior: TimelineBehavior;
  include_in_planning_progress: boolean;
  timeline_color: PlanningTimelineColor | null;
  library_phase_id: string | null;
  blocked_by_phase_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type PlanningPhaseInput = Omit<PlanningPhase, "id" | "created_at" | "updated_at">;

export type PlanningItem = {
  id: string;
  phase_id: string;
  title: string;
  notes: string;
  owner: string | null;
  is_complete: boolean;
  estimated_hours: number;
  due_date: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningItemInput = Omit<PlanningItem, "id" | "created_at" | "updated_at">;

export type PhaseLibraryEntry = {
  id: string;
  name: string;
  default_description: string;
  default_category: PlanningCategory;
  suggested_owner: string | null;
  suggested_duration_days: number | null;
  default_timeline_behavior: TimelineBehavior;
  default_include_in_planning_progress: boolean;
  default_timeline_color: PlanningTimelineColor;
  active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PhaseLibraryEntryInput = Omit<PhaseLibraryEntry, "id" | "created_at" | "updated_at">;

export type PhaseLibraryItem = {
  id: string;
  library_phase_id: string;
  title: string;
  notes: string;
  suggested_owner: string | null;
  estimated_hours: number;
  suggested_due_offset_days: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PhaseLibraryItemInput = Omit<PhaseLibraryItem, "id" | "created_at" | "updated_at">;

export const statusLabels: Record<PlanningStatus, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In Progress",
  waiting: "Waiting",
  done: "Done",
};

export const categoryLabels: Record<PlanningCategory, string> = {
  internal: "Internal",
  customer: "Customer",
  vendor: "Vendor",
  logistics: "Logistics",
  blocker: "Blocker",
  reference: "Reference",
};
