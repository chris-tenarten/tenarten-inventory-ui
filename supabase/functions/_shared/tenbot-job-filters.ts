/** Canonical bounded read selectors, shared by count/list/routing. No data access. */
export const JOB_LIFECYCLE_STATUSES = ['not_started','on_deck','in_production','on_hold','shipped','complete','cancelled'] as const;
export type JobLifecycleStatus = typeof JOB_LIFECYCLE_STATUSES[number];
export const JOB_SCHEDULE_STATES = ['all','scheduled','unscheduled'] as const;
export type JobScheduleState = typeof JOB_SCHEDULE_STATES[number];
export function parseJobSchedule(value:unknown):JobScheduleState|null{
 return value===undefined?'all':typeof value==='string'&&JOB_SCHEDULE_STATES.includes(value as JobScheduleState)?value as JobScheduleState:null;
}
/** Omitted/empty preserves the existing unfiltered executor contract. */
export function parseJobStatuses(value:unknown):JobLifecycleStatus[]|null{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>JOB_LIFECYCLE_STATUSES.length||value.some(v=>typeof v!=='string'||!JOB_LIFECYCLE_STATUSES.includes(v as JobLifecycleStatus))||new Set(value).size!==value.length)return null;
 return JOB_LIFECYCLE_STATUSES.filter(status=>value.includes(status));
}
export function matchesJobPopulation(job:{archived:boolean;effective:{status:string;planned_start?:string|null;planned_end?:string|null}},selection:{statuses:readonly string[];includeArchived:boolean;schedule?:JobScheduleState}){
 const scheduled=Boolean(job.effective.planned_start&&job.effective.planned_end);
 return (selection.includeArchived||!job.archived)&&(!selection.statuses.length||selection.statuses.includes(job.effective.status))&&(selection.schedule===undefined||selection.schedule==='all'||(selection.schedule==='scheduled')===scheduled);
}
