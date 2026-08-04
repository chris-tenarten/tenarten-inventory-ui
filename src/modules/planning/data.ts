import { supabase } from "@/lib/supabase";
import { addCalendarDays, formatScheduleDate } from "@/modules/production/schedule";
import type {
  PhaseLibraryEntry,
  PhaseLibraryEntryInput,
  PhaseLibraryItem,
  PhaseLibraryItemInput,
  PlanningItem,
  PlanningItemInput,
  PlanningPhase,
  PlanningPhaseInput,
} from "./types";
import { countsTowardPlanningPhaseLimit, MAX_PLANNING_PHASES } from "./types";
import { normalizeLoadedJobIds } from "./timeline-model.mjs";

const PHASE_COLUMNS = "id,job_id,title,description,owner,category,status,start_date,end_date,timeline_behavior,include_in_planning_progress,timeline_color,library_phase_id,blocked_by_phase_id,created_at,updated_at,created_by";
const ITEM_COLUMNS = "id,phase_id,title,notes,owner,is_complete,estimated_hours,due_date,sort_order,created_by,created_at,updated_at";

export async function loadPlanningPhases(jobScope?: string | string[]) {
  let query = supabase.from("planning_phases").select(PHASE_COLUMNS).order("updated_at", { ascending: false });
  if (Array.isArray(jobScope)) {
    const jobIds = normalizeLoadedJobIds(jobScope);
    if (jobIds.length === 0) return [];
    query = query.in("job_id", jobIds);
  } else if (jobScope) {
    query = query.eq("job_id", jobScope);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PlanningPhase[];
}

export async function loadPlanningItems(phaseIds: string[]) {
  if (phaseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("planning_items")
    .select(ITEM_COLUMNS)
    .in("phase_id", phaseIds)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as PlanningItem[];
}

export async function createPlanningPhase(input: PlanningPhaseInput) {
  if (countsTowardPlanningPhaseLimit(input.timeline_behavior)) await assertPlanningPhaseSlot(input.job_id);
  const { data, error } = await supabase.from("planning_phases").insert(input).select(PHASE_COLUMNS).single();
  if (error) throw error;
  return data as PlanningPhase;
}

export async function updatePlanningPhase(id: string, input: PlanningPhaseInput) {
  const { data: existing, error: existingError } = await supabase
    .from("planning_phases")
    .select("timeline_behavior")
    .eq("id", id)
    .single();
  if (existingError) throw existingError;
  if (!countsTowardPlanningPhaseLimit(existing.timeline_behavior) && countsTowardPlanningPhaseLimit(input.timeline_behavior)) {
    await assertPlanningPhaseSlot(input.job_id);
  }
  const { data, error } = await supabase.from("planning_phases").update(input).eq("id", id).select(PHASE_COLUMNS).single();
  if (error) throw error;
  return data as PlanningPhase;
}

async function assertPlanningPhaseSlot(jobId: string) {
  const { count, error } = await supabase
    .from("planning_phases")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .neq("timeline_behavior", "pause");
  if (error) throw error;
  if ((count ?? 0) >= MAX_PLANNING_PHASES) {
    throw new Error("Maximum of four Planning Phases per Production job. Pause intervals do not count toward this limit.");
  }
}

export async function deletePlanningPhase(id: string) {
  const { error } = await supabase.from("planning_phases").delete().eq("id", id);
  if (error) throw error;
}

export async function createPlanningItem(input: PlanningItemInput) {
  const { data, error } = await supabase.from("planning_items").insert(input).select(ITEM_COLUMNS).single();
  if (error) throw error;
  return data as PlanningItem;
}

export async function updatePlanningItem(id: string, input: Partial<PlanningItemInput>) {
  const { data, error } = await supabase.from("planning_items").update(input).eq("id", id).select(ITEM_COLUMNS).single();
  if (error) throw error;
  return data as PlanningItem;
}

export async function deletePlanningItem(id: string) {
  const { error } = await supabase.from("planning_items").delete().eq("id", id);
  if (error) throw error;
}

export async function loadPhaseLibrary() {
  const [entriesResult, itemsResult] = await Promise.all([
    supabase.from("planning_phase_library").select("*").order("sort_order").order("name"),
    supabase.from("planning_phase_library_items").select("*").order("sort_order").order("created_at"),
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (itemsResult.error) throw itemsResult.error;
  return {
    entries: (entriesResult.data ?? []) as PhaseLibraryEntry[],
    items: (itemsResult.data ?? []) as PhaseLibraryItem[],
  };
}

export async function createPhaseLibraryEntry(input: PhaseLibraryEntryInput) {
  const { data, error } = await supabase.from("planning_phase_library").insert(input).select("*").single();
  if (error) throw error;
  return data as PhaseLibraryEntry;
}

export async function updatePhaseLibraryEntry(id: string, input: PhaseLibraryEntryInput) {
  const { data, error } = await supabase.from("planning_phase_library").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data as PhaseLibraryEntry;
}

export async function deletePhaseLibraryEntry(id: string) {
  const { error } = await supabase.from("planning_phase_library").delete().eq("id", id);
  if (error) throw error;
}

export async function createPhaseLibraryItem(input: PhaseLibraryItemInput) {
  const { data, error } = await supabase.from("planning_phase_library_items").insert(input).select("*").single();
  if (error) throw error;
  return data as PhaseLibraryItem;
}

export async function updatePhaseLibraryItem(id: string, input: PhaseLibraryItemInput) {
  const { data, error } = await supabase.from("planning_phase_library_items").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data as PhaseLibraryItem;
}

export async function deletePhaseLibraryItem(id: string) {
  const { error } = await supabase.from("planning_phase_library_items").delete().eq("id", id);
  if (error) throw error;
}

function shiftedDate(startDate: string | null, offset: number | null) {
  if (!startDate || offset === null) return null;
  return formatScheduleDate(addCalendarDays(startDate, offset));
}

export async function copyLibraryPhaseToJob(
  jobId: string,
  entry: PhaseLibraryEntry,
  libraryItems: PhaseLibraryItem[],
  productionStart: string | null,
) {
  if (entry.default_timeline_behavior !== "planning_only" && !productionStart) {
    throw new Error("Set the Production planned start before adding this dated Phase Library definition.");
  }
  const duration = entry.suggested_duration_days ?? 1;
  const startDate = entry.default_timeline_behavior === "planning_only" ? null : productionStart;
  const phase = await createPlanningPhase({
    job_id: jobId,
    title: entry.name,
    description: entry.default_description,
    owner: entry.suggested_owner,
    category: entry.default_category,
    status: "open",
    start_date: startDate,
    end_date: startDate ? shiftedDate(startDate, duration - 1) : null,
    timeline_behavior: entry.default_timeline_behavior,
    include_in_planning_progress: entry.default_timeline_behavior !== "pause",
    timeline_color: entry.default_timeline_behavior === "overlay" ? entry.default_timeline_color : null,
    library_phase_id: entry.id,
    blocked_by_phase_id: null,
    created_by: null,
  });

  try {
    const copiedItems: PlanningItem[] = [];
    for (const template of libraryItems.filter((item) => entry.default_timeline_behavior !== "pause" && item.library_phase_id === entry.id)) {
      copiedItems.push(
        await createPlanningItem({
          phase_id: phase.id,
          title: template.title,
          notes: template.notes,
          owner: template.suggested_owner,
          is_complete: false,
          estimated_hours: template.estimated_hours,
          due_date: shiftedDate(phase.start_date, template.suggested_due_offset_days),
          sort_order: template.sort_order,
          created_by: null,
        }),
      );
    }
    return { phase, items: copiedItems };
  } catch (error) {
    await deletePlanningPhase(phase.id);
    throw error;
  }
}
