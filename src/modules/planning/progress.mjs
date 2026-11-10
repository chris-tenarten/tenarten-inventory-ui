export function calculatePhaseProgress(items) {
  const completedItems = items.filter((item) => item.is_complete).length;
  const totalHours = items.reduce((sum, item) => sum + Number(item.estimated_hours || 0), 0);
  const completedHours = items.reduce((sum, item) => sum + (item.is_complete ? Number(item.estimated_hours || 0) : 0), 0);
  return {
    completedItems,
    totalItems: items.length,
    completedHours,
    totalHours,
    percent: totalHours ? Math.round((completedHours / totalHours) * 100) : 0,
  };
}

export function calculatePlanningProgress(phases, items) {
  const includedPhaseIds = new Set(phases.filter((phase) => phase.timeline_behavior !== "pause").map((phase) => phase.id));
  return calculatePhaseProgress(items.filter((item) => includedPhaseIds.has(item.phase_id)));
}

export function calculatePlanningCoverage(phases, items) {
  const activePhaseIds = new Set(phases.filter((phase) => phase.timeline_behavior !== "pause").map((phase) => phase.id));
  const plannedItems = items.filter((item) => activePhaseIds.has(item.phase_id));
  return {
    plannedItems: plannedItems.length,
    plannedHours: plannedItems.reduce((sum, item) => sum + Number(item.estimated_hours || 0), 0),
    activePhases: activePhaseIds.size,
  };
}

export function formatPlanningHours(hours) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(hours);
}
