const DAY_MS = 86_400_000;

function ordinal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid Planning schedule date: ${value}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
}

function dateFromOrdinal(value) {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

export function adjustPlanningInterval(start, end, deltaDays, mode) {
  if (mode === 'move') return { start: dateFromOrdinal(ordinal(start) + deltaDays), end: dateFromOrdinal(ordinal(end) + deltaDays) };
  if (mode === 'resize-start') {
    const candidate = dateFromOrdinal(ordinal(start) + deltaDays);
    return { start: candidate > end ? end : candidate, end };
  }
  const candidate = dateFromOrdinal(ordinal(end) + deltaDays);
  return { start, end: candidate < start ? start : candidate };
}

export function planningProductionStartDelta(persistedStart, proposedStart) {
  return persistedStart && proposedStart ? ordinal(proposedStart) - ordinal(persistedStart) : 0;
}

export function translatedPlanningIntervals(phases, staged, jobId, deltaDays) {
  if (deltaDays === 0) return [];
  return phases.filter((phase) => phase.job_id === jobId && phase.start_date && phase.end_date).map((phase) => {
    const existing = staged[phase.id];
    const adjusted = adjustPlanningInterval(existing?.proposed_start_date ?? phase.start_date, existing?.proposed_end_date ?? phase.end_date, deltaDays, 'move');
    return { phase, start: adjusted.start, end: adjusted.end, source: existing?.change_source ?? 'production_reschedule' };
  });
}

export function dependentPlanningPhaseIds(phases, rootPhaseId) {
  const descendants = [];
  const visited = new Set([rootPhaseId]);
  const queue = [rootPhaseId];
  while (queue.length) {
    const parentId = queue.shift();
    phases.filter((phase) => phase.blocked_by_phase_id === parentId).forEach((phase) => {
      if (visited.has(phase.id)) return;
      visited.add(phase.id);
      descendants.push(phase.id);
      queue.push(phase.id);
    });
  }
  return descendants;
}

export function planningDependencyGraphIsAcyclic(phases, rootPhaseId) {
  const childrenByParent = new Map();
  phases.forEach((phase) => {
    if (!phase.blocked_by_phase_id) return;
    const children = childrenByParent.get(phase.blocked_by_phase_id) ?? [];
    children.push(phase.id);
    childrenByParent.set(phase.blocked_by_phase_id, children);
  });
  const visited = new Set();
  const active = new Set();
  const visit = (phaseId) => {
    if (active.has(phaseId)) return false;
    if (visited.has(phaseId)) return true;
    active.add(phaseId);
    const healthy = (childrenByParent.get(phaseId) ?? []).every(visit);
    active.delete(phaseId);
    visited.add(phaseId);
    return healthy;
  };
  return visit(rootPhaseId);
}

export function planningCascadeDelta(originalStart, originalEnd, proposedStart, proposedEnd, mode) {
  if (mode === 'move') return ordinal(proposedStart) - ordinal(originalStart);
  if (mode === 'resize-end') return ordinal(proposedEnd) - ordinal(originalEnd);
  return 0;
}

export function evaluatePlanningSchedule(phases, jobs) {
  const byId = new Map(phases.map((phase) => [phase.id, phase]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const issues = [];
  const dependencyFormsCycle = (phase) => {
    const visited = new Set([phase.id]);
    let currentId = phase.blocked_by_phase_id;
    while (currentId) {
      if (visited.has(currentId)) return true;
      visited.add(currentId);
      currentId = byId.get(currentId)?.blocked_by_phase_id ?? null;
    }
    return false;
  };

  phases.forEach((phase) => {
    if (phase.start_date && phase.end_date && phase.end_date < phase.start_date) {
      issues.push({ id: `interval:${phase.id}`, severity: 'error', kind: 'invalid_interval', phase_ids: [phase.id], predecessor_id: null, successor_id: phase.id, message: `${phase.title} has an invalid date interval.` });
    }
    if (phase.blocked_by_phase_id) {
      const predecessor = byId.get(phase.blocked_by_phase_id);
      if (!predecessor || predecessor.job_id !== phase.job_id) {
        issues.push({ id: `dependency:${phase.blocked_by_phase_id}:${phase.id}:invalid`, severity: 'error', kind: 'invalid_dependency', phase_ids: [phase.id], predecessor_id: phase.blocked_by_phase_id, successor_id: phase.id, message: `${phase.title} has an invalid dependency.` });
      } else if (dependencyFormsCycle(phase)) {
        issues.push({ id: `dependency:${predecessor.id}:${phase.id}:cycle`, severity: 'error', kind: 'circular_dependency', phase_ids: [predecessor.id, phase.id], predecessor_id: predecessor.id, successor_id: phase.id, message: `${phase.title} contains a circular dependency with ${predecessor.title}.` });
      } else if (predecessor.end_date && phase.start_date && phase.start_date <= predecessor.end_date) {
        issues.push({ id: `dependency:${predecessor.id}:${phase.id}:overlap`, severity: 'warning', kind: 'dependency_overlap', phase_ids: [predecessor.id, phase.id], predecessor_id: predecessor.id, successor_id: phase.id, message: `${phase.title} begins before ${predecessor.title} completes. Dependency preserved.` });
      }
    }
    const job = jobsById.get(phase.job_id);
    if (job?.requested_delivery_date && phase.start_date && phase.start_date > job.requested_delivery_date) {
      issues.push({ id: `delivery:${phase.id}`, severity: 'warning', kind: 'after_delivery', phase_ids: [phase.id], predecessor_id: null, successor_id: phase.id, message: `${phase.title} falls after requested delivery.` });
    }
    if (phase.start_date && phase.end_date && job?.planned_start && job.planned_end) {
      const beginsBefore = phase.start_date < job.planned_start;
      const finishesAfter = phase.end_date > job.planned_end;
      const doesNotIntersect = phase.end_date < job.planned_start || phase.start_date > job.planned_end;
      if (phase.timeline_behavior === 'pause' && doesNotIntersect) {
        issues.push({ id: `preliminary:${phase.id}:outside`, severity: 'warning', kind: 'outside_preliminary_timeline', phase_ids: [phase.id], predecessor_id: null, successor_id: phase.id, message: `${phase.title}: This calendar constraint does not intersect the job’s preliminary timeline.`, inspector_message: 'Calendar constraint does not intersect preliminary timeline' });
      } else if (beginsBefore && finishesAfter) {
        issues.push({ id: `preliminary:${phase.id}:both`, severity: 'warning', kind: 'spans_preliminary_timeline', phase_ids: [phase.id], predecessor_id: null, successor_id: phase.id, message: `${phase.title}: This Phase begins before and finishes after the job’s preliminary timeline.`, inspector_message: 'Begins before and finishes after preliminary timeline' });
      } else if (beginsBefore) {
        const days = ordinal(job.planned_start) - ordinal(phase.start_date);
        issues.push({ id: `preliminary:${phase.id}:before`, severity: 'warning', kind: 'before_preliminary_timeline', phase_ids: [phase.id], predecessor_id: null, successor_id: phase.id, message: `${phase.title} begins ${days} day${days === 1 ? '' : 's'} before the job’s preliminary timeline.`, inspector_message: 'Begins before preliminary timeline' });
      } else if (finishesAfter) {
        const days = ordinal(phase.end_date) - ordinal(job.planned_end);
        issues.push({ id: `preliminary:${phase.id}:after`, severity: 'warning', kind: 'after_preliminary_timeline', phase_ids: [phase.id], predecessor_id: null, successor_id: phase.id, message: `${phase.title} finishes ${days} day${days === 1 ? '' : 's'} after the job’s preliminary timeline.`, inspector_message: 'Finishes after preliminary timeline' });
      }
    }
  });
  return issues;
}
