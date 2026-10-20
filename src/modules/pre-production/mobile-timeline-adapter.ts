import type { PlanningRecord } from './planning-model';
import type { Bid } from './types';
import { openProductionJob } from '@/modules/production/job-options';
import { productionStatusVisualByValue } from '@/modules/production/status-visuals';
import { mobilePhaseMarkers } from '@/modules/production/mobile-timeline-adapter';
import type { MobileTimelineRow } from '@/components/mobile/MobileTimeline';
/** Eligibility, mode, role filtering and lifecycle identity are supplied by normalizePlanning/planningForMode. */
export function mobileBidRows(items: PlanningRecord[], open: (bid: Bid) => void): MobileTimelineRow[] {
  return items.map(item => item.source === 'intake' ? {
    key:item.key,title:item.bid.projectName,reference:'Bid',status:item.bid.status,start:item.start,end:item.end,projected:true,markers:[],open:()=>open(item.bid),
  } : {
    key:item.key,title:item.job.name,reference:item.job.job_number||'Production Job',status:productionStatusVisualByValue[item.job.production_status].label+' · View in Production',start:item.start,end:item.end,
    visual:productionStatusVisualByValue[item.job.production_status],markers:mobilePhaseMarkers(item.phases,true),open:()=>openProductionJob(item.job.id),
  });
}
