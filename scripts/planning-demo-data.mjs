import { createClient } from "@supabase/supabase-js";

const action = process.argv[2];
const jobId = process.argv[3];
const CONTROLLED_JOB_ID = "cba79566-3fde-4910-9cf6-45687db70b01";
const CONTROLLED_JOB_NUMBER = "DEV-20260803";
const CONTROLLED_JOB_NAME = "chris-dev-test";
const marker = "[TENOPS PLANNING DEMO] Batch: planning-mvp-anthony-v1";
const originalDates = { planned_start: "2026-08-03", planned_end: "2026-08-14", requested_delivery_date: "2026-08-17" };
const demoDates = { planned_start: "2026-08-03", planned_end: "2026-08-28", requested_delivery_date: "2026-08-31" };

if (!["create", "cleanup"].includes(action) || jobId !== CONTROLLED_JOB_ID) throw new Error(`Usage: node --env-file=.env.local scripts/planning-demo-data.mjs <create|cleanup> ${CONTROLLED_JOB_ID}`);
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: job, error: jobError } = await supabase.from("jobs").select("id,job_number,name,planned_start,planned_end,requested_delivery_date").eq("id", jobId).single();
if (jobError) throw jobError;
if (job.job_number !== CONTROLLED_JOB_NUMBER || job.name !== CONTROLLED_JOB_NAME) throw new Error("Controlled Planning demo job identity does not match the expected UUID, number, and name.");
const { data: existing, error: existingError } = await supabase.from("planning_phases").select("id,title").eq("job_id", jobId).like("description", `${marker}%`);
if (existingError) throw existingError;

if (action === "cleanup") {
  if (existing.length) { const { error } = await supabase.from("planning_phases").delete().in("id", existing.map((phase) => phase.id)); if (error) throw error; }
  const { error: dateError } = await supabase.from("jobs").update(originalDates).eq("id", CONTROLLED_JOB_ID); if (dateError) throw dateError;
  console.log(JSON.stringify({ action, job_id: jobId, removed_phase_count: existing.length, removed_titles: existing.map((phase) => phase.title).sort(), restored_dates: originalDates }));
  process.exit(0);
}
if (existing.length) throw new Error(`Controlled Planning demo data already exists. Run cleanup before recreating it.`);

const definitions = [
  { title: "Color Plate", owner: "Anthony", category: "customer", status: "in_progress", start_date: "2026-08-04", end_date: "2026-08-07", timeline_behavior: "overlay", include_in_planning_progress: true, dependsOn: null, items: [["Receive artwork", true], ["Pour sample", false]] },
  { title: "Shop Drawings", owner: "Anthony", category: "customer", status: "in_progress", start_date: "2026-08-06", end_date: "2026-08-12", timeline_behavior: "overlay", include_in_planning_progress: true, dependsOn: "Color Plate", items: [["Prepare drawing set", true], ["Internal coordination", false]] },
  { title: "Customer Approval", owner: "Chris", category: "customer", status: "waiting", start_date: "2026-08-13", end_date: "2026-08-17", timeline_behavior: "overlay", include_in_planning_progress: true, dependsOn: "Shop Drawings", items: [["Confirm written approval", false]] },
  { title: "Production Freeze", owner: "Anthony", category: "blocker", status: "waiting", start_date: "2026-08-18", end_date: "2026-08-19", timeline_behavior: "pause", include_in_planning_progress: true, dependsOn: "Customer Approval", items: [["Notify Production team", false]] },
];
const created = [];
try {
  for (const [phaseOrder, definition] of definitions.entries()) {
    const { items, dependsOn, ...phaseValues } = definition;
    const prerequisite = dependsOn ? created.find((phase) => phase.title === dependsOn) : null;
    if (dependsOn && !prerequisite) throw new Error(`Missing controlled prerequisite Phase: ${dependsOn}`);
    const { data: phase, error } = await supabase.from("planning_phases").insert({ ...phaseValues, job_id: jobId, description: `${marker}\nControlled Phase order: ${phaseOrder}.`, blocked_by_phase_id: prerequisite?.id ?? null, created_by: "Chris controlled test" }).select("id,title").single();
    if (error) throw error; created.push(phase);
    if (items.length) { const { error: itemError } = await supabase.from("planning_items").insert(items.map(([title, is_complete], sort_order) => ({ phase_id: phase.id, title, is_complete, sort_order, created_by: "Chris controlled test" }))); if (itemError) throw itemError; }
  }
  const { error: dateError } = await supabase.from("jobs").update(demoDates).eq("id", CONTROLLED_JOB_ID); if (dateError) throw dateError;
} catch (error) {
  if (created.length) await supabase.from("planning_phases").delete().in("id", created.map((phase) => phase.id));
  throw error;
}
console.log(JSON.stringify({ action, job_id: jobId, created_phase_count: created.length, created_titles: created.map((phase) => phase.title), previous_dates: { planned_start: job.planned_start, planned_end: job.planned_end, requested_delivery_date: job.requested_delivery_date }, resulting_dates: demoDates }));
