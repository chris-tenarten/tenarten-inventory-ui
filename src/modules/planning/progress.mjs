export function calculatePhaseProgress(items) {
  const complete = items.filter((item) => item.is_complete).length;
  return {
    complete,
    total: items.length,
    percent: items.length ? Math.round((complete / items.length) * 100) : 0,
  };
}

export function calculatePlanningProgress(phases, items) {
  const includedPhaseIds = new Set(phases.filter((phase) => phase.timeline_behavior !== "pause").map((phase) => phase.id));
  return calculatePhaseProgress(items.filter((item) => includedPhaseIds.has(item.phase_id)));
}
