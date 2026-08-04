import { createClient } from "@supabase/supabase-js";

const action = process.argv[2];
const jobId = process.argv[3];
const CONTROLLED_JOB_ID = "cba79566-3fde-4910-9cf6-45687db70b01";
const CONTROLLED_JOB_NUMBER = "DEV-20260803";
const CONTROLLED_JOB_NAME = "chris-dev-test";
const marker = "[TENOPS PLANNING DEMO] Batch: planning-execution-anthony-v2";
const controlledMarkers = [marker, "[TENOPS PLANNING DEMO] Batch: planning-mvp-anthony-v1"];

if (!["create", "cleanup"].includes(action) || jobId !== CONTROLLED_JOB_ID) throw new Error(`Usage: node --env-file=.env.local scripts/planning-demo-data.mjs <create|cleanup> ${CONTROLLED_JOB_ID}`);
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: job, error: jobError } = await supabase.from("jobs").select("id,job_number,name,planned_start,planned_end,requested_delivery_date").eq("id", jobId).single();
if (jobError) throw jobError;
if (job.job_number !== CONTROLLED_JOB_NUMBER || job.name !== CONTROLLED_JOB_NAME) throw new Error("Controlled Planning demo job identity does not match the expected UUID, number, and name.");
const { data: controlledPhases, error: existingError } = await supabase.from("planning_phases").select("id,title,description").eq("job_id", jobId);
if (existingError) throw existingError;
const existing = controlledPhases.filter((phase) => controlledMarkers.some((candidate) => phase.description.startsWith(candidate)));

if (action === "cleanup") {
  if (existing.length) { const { error } = await supabase.from("planning_phases").delete().in("id", existing.map((phase) => phase.id)); if (error) throw error; }
  console.log(JSON.stringify({ action, job_id: jobId, removed_phase_count: existing.length, removed_titles: existing.map((phase) => phase.title).sort(), production_dates_unchanged: true }));
  process.exit(0);
}
if (existing.length) throw new Error(`Controlled Planning demo data already exists. Run cleanup before recreating it.`);

const definitions = [
  { title: "Prep", owner: "Anthony", category: "internal", status: "in_progress", start_date: "2026-08-03", end_date: "2026-08-07", timeline_behavior: "overlay", include_in_planning_progress: true, dependsOn: null, items: [["Blend Chips", 3, true], ["Set Up Forms & Apply Wax", 5, true], ["Set Up Epoxy for Mix", 2, true], ["Mix & Fill Forms with Terrazzo", 2.5, false]] },
  { title: "Grind", owner: "Anthony", category: "internal", status: "in_progress", start_date: "2026-08-08", end_date: "2026-08-14", timeline_behavior: "overlay", include_in_planning_progress: true, dependsOn: "Prep", items: [["Remove from Forms & Clean Tables", 2, true], ["Rough Grind on Wizard", 5, true], ["Apply Grout Coat", 3, false], ["Remove Grout & Polish to 200 Grit", 6, false]] },
  { title: "CTS", owner: "Anthony", category: "internal", status: "planned", start_date: "2026-08-15", end_date: "2026-08-20", timeline_behavior: "overlay", include_in_planning_progress: true, dependsOn: "Grind", items: [["Cut to Size & Trim", 2, true], ["Ease & Polish Top Edge", 3, false], ["Apply Metal", 2, false], ["Cut Grooves", 3, false]] },
  { title: "Production Freeze", owner: "Anthony", category: "blocker", status: "waiting", start_date: "2026-08-21", end_date: "2026-08-22", timeline_behavior: "pause", include_in_planning_progress: false, shift_with_production: false, dependsOn: "CTS", items: [] },
  { title: "Finish", owner: "Anthony", category: "logistics", status: "planned", start_date: "2026-08-23", end_date: "2026-08-28", timeline_behavior: "overlay", include_in_planning_progress: true, dependsOn: "Production Freeze", items: [["Polish to 1500", 5, false], ["Clean & Apply Sealer", 2, false], ["Build A-Frame", 4, false], ["Crate for Delivery", 3, false]] },
];
const created = [];
try {
  for (const [phaseOrder, definition] of definitions.entries()) {
    const { items, dependsOn, ...phaseValues } = definition;
    const prerequisite = dependsOn ? created.find((phase) => phase.title === dependsOn) : null;
    if (dependsOn && !prerequisite) throw new Error(`Missing controlled prerequisite Phase: ${dependsOn}`);
    const { data: phase, error } = await supabase.from("planning_phases").insert({ ...phaseValues, job_id: jobId, description: `${marker}\nControlled Phase order: ${phaseOrder}.`, blocked_by_phase_id: prerequisite?.id ?? null, created_by: "Chris controlled test" }).select("id,title").single();
    if (error) throw error; created.push(phase);
    if (items.length) { const { error: itemError } = await supabase.from("planning_items").insert(items.map(([title, estimated_hours, is_complete], sort_order) => ({ phase_id: phase.id, title, estimated_hours, is_complete, sort_order, created_by: "Chris controlled test" }))); if (itemError) throw itemError; }
  }
} catch (error) {
  if (created.length) await supabase.from("planning_phases").delete().in("id", created.map((phase) => phase.id));
  throw error;
}
console.log(JSON.stringify({ action, job_id: jobId, created_phase_count: created.length, created_titles: created.map((phase) => phase.title), production_dates_unchanged: { planned_start: job.planned_start, planned_end: job.planned_end, requested_delivery_date: job.requested_delivery_date } }));
