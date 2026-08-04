export function isPlanningEnabled(value) {
  return value === "true";
}

export function normalizeLoadedJobIds(jobIds) {
  return [...new Set(jobIds.filter((id) => typeof id === "string" && id.length > 0))];
}

export function rangesIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  return Boolean(firstStart && firstEnd && secondStart && secondEnd && firstStart <= secondEnd && firstEnd >= secondStart);
}

const DAY_IN_MILLISECONDS = 86_400_000;

function dateOrdinal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid Planning Timeline date: ${value}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_IN_MILLISECONDS;
}

export function planningIntervalGeometry(intervalStart, intervalEnd, canvasStart, dayWidth) {
  const startDay = dateOrdinal(intervalStart);
  const endDay = dateOrdinal(intervalEnd);
  const canvasStartDay = dateOrdinal(canvasStart);
  if (!Number.isFinite(dayWidth) || dayWidth <= 0) throw new Error("Planning Timeline day width must be positive.");
  if (endDay < startDay) throw new Error("Planning Timeline interval end must not precede its start.");
  const left = (startDay - canvasStartDay) * dayWidth + 3;
  const width = Math.max(12, (endDay - startDay + 1) * dayWidth - 6);
  return { left, width, right: left + width };
}

export function pausePlacement(phase, productionStart, productionEnd) {
  if (!phase.start_date || !phase.end_date || phase.timeline_behavior !== "pause") return "not_pause";
  return rangesIntersect(phase.start_date, phase.end_date, productionStart, productionEnd)
    ? "intersects_production"
    : "outside_production";
}

export function selectCollapsedTimelinePhases(phases, options) {
  const { canvasStart, canvasEnd } = options;
  const eligible = phases.filter(
    (phase) =>
      phase.timeline_behavior !== "planning_only" &&
      phase.start_date &&
      phase.end_date &&
      rangesIntersect(phase.start_date, phase.end_date, canvasStart, canvasEnd),
  );
  const ordered = [...eligible].sort((first, second) =>
    first.start_date.localeCompare(second.start_date) ||
    (first.created_at ?? "").localeCompare(second.created_at ?? "") ||
    first.id.localeCompare(second.id));
  return { visible: ordered, hidden: [], all: ordered };
}

export function mergePauseRanges(phases) {
  const pauses = phases
    .filter((phase) => phase.timeline_behavior === "pause" && phase.start_date && phase.end_date)
    .sort(
      (first, second) =>
        first.start_date.localeCompare(second.start_date) ||
        first.end_date.localeCompare(second.end_date) ||
        first.id.localeCompare(second.id),
    );
  return pauses.reduce((ranges, phase) => {
    const previous = ranges.at(-1);
    if (previous && phase.start_date <= previous.end) {
      previous.end = phase.end_date > previous.end ? phase.end_date : previous.end;
      previous.phases.push(phase);
    } else {
      ranges.push({ start: phase.start_date, end: phase.end_date, phases: [phase] });
    }
    return ranges;
  }, []);
}
