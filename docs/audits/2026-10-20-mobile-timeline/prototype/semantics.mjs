// Meanings come from existing Planning/Production definitions; no scheduling commands.
import {overlayVisualForPhase,PLANNING_PAUSE_HATCH,PLANNING_OVERLAY_PALETTE} from '../../../../src/modules/planning/phase-visuals.ts';
import {productionStatusVisuals,productionStatusVisualByValue} from '../../../../src/modules/production/status-visuals.ts';
export {PLANNING_PAUSE_HATCH,PLANNING_OVERLAY_PALETTE,productionStatusVisuals};
export const rulerHeight=44;
export const railWidth=(width,expanded=false)=>expanded?(width<=350?148:168):(width<=350?86:100);
export function rowStatus(row){return row.source==='intake'?`Bid ${row.status==='won'?'Won':'Active'}`:productionStatusVisualByValue[row.status].label;}
export function indicatorsFor(row){
 const list=row.phases.filter(p=>(row.showPlanningOnly||p.timeline_behavior!=='planning_only')&&p.start_date&&p.end_date).map(p=>({id:p.id,kind:p.timeline_behavior,title:p.title,start:p.start_date,end:p.end_date,visual:overlayVisualForPhase(row.phases,p.id),label:p.timeline_behavior==='pause'?'Planning pause':p.timeline_behavior==='planning_only'?'Planning only':'Planning phase',short:p.timeline_behavior==='pause'?'Pause':p.timeline_behavior==='planning_only'?'Plan only':'Phase',meaning:p.timeline_behavior==='pause'?'A pause interval attached to this Job’s plan. Separate from the Job’s Production status; not a Bid.':p.timeline_behavior==='planning_only'?'A dated Planning-only reference for this Job. Shown in Bids Planning’s Production reference; omitted from the Production chart.':'A Planning phase attached to this Production Job, not a Bid. Its color identifies the phase, not Production status or completion.'}));
 for(const m of row.milestones||[])list.push({id:m.id,kind:'delivery',title:'Requested delivery',label:'Requested delivery',short:'Delivery',start:m.date,end:m.date,meaning:'For this Job without complete Production dates, its requested delivery date is a milestone, not a Production start, finish, or promised delivery.'});
 return list;
}
