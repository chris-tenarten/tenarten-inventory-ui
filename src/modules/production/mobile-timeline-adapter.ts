import type { ProductionJob } from './types';
import { arrangeProductionTimelineJobs } from './arrangement';
import type { StagedSchedules } from './schedule-staging';
import { productionStatusVisualByValue } from './status-visuals';
import type { PlanningPhase } from '@/modules/planning/types';
import { planningPhaseWithStagedDates, type StagedPlanningSchedules } from '@/modules/planning/schedule-staging';
import { overlayVisualForPhase, PLANNING_PAUSE_HATCH } from '@/modules/planning/phase-visuals';
import type { MobileTimelineRow } from '@/components/mobile/MobileTimeline';
export function mobilePhaseMarkers(phases: PlanningPhase[], includePlanningOnly: boolean): MobileTimelineRow['markers'] {
  return phases.filter(p => p.start_date && p.end_date && (includePlanningOnly || p.timeline_behavior !== 'planning_only')).map(p => ({
    id: p.id, title: p.title, start: p.start_date!, end: p.end_date!,
    className: overlayVisualForPhase(phases,p.id).className,
    visual: p.timeline_behavior === 'pause' ? {backgroundImage: PLANNING_PAUSE_HATCH} : undefined,
    meaning: p.timeline_behavior === 'pause' ? 'Planning pause. Existing schedule effects remain controlled by Production.' : p.timeline_behavior === 'planning_only' ? 'Planning reference only; no Production schedule effect.' : 'Planning phase. Existing dependencies and progress remain in Job details.',
  }));
}
export function mobileProductionRows(jobs: ProductionJob[], staged: StagedSchedules, phases: PlanningPhase[], stagedPhases: StagedPlanningSchedules, open: (job: ProductionJob) => void): MobileTimelineRow[] {
  return arrangeProductionTimelineJobs(jobs.map(job => staged[job.id] ? {...job, planned_start: staged[job.id].proposed_planned_start, planned_end: staged[job.id].proposed_planned_end} : job)).map(job => ({
    key: job.id, title: job.name, reference: job.job_number || 'Production Job', status: productionStatusVisualByValue[job.production_status].label,
    start: job.planned_start, end: job.planned_end, staged: Boolean(staged[job.id]), visual: productionStatusVisualByValue[job.production_status],
    markers: [...mobilePhaseMarkers(phases.filter(p => p.job_id === job.id).map(p => planningPhaseWithStagedDates(p,stagedPhases)),false),
      ...(!(job.planned_start && job.planned_end) && job.requested_delivery_date ? [{id:'requested-delivery',className:'mt-delivery',title:'Requested delivery',start:job.requested_delivery_date,end:job.requested_delivery_date,visual:{backgroundColor:'#e9d5ff',borderColor:'#7e22ce'},meaning:'Requested delivery date; not a committed Production schedule.'}] : [])],
    open: () => open(job),
  }));
}
