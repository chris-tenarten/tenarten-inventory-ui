/** Canonical bounded read selectors, shared by count/list/routing. No data access. */
export const JOB_LIFECYCLE_STATUSES = ['not_started','on_deck','in_production','on_hold','shipped','complete','cancelled'] as const;
export type JobLifecycleStatus = typeof JOB_LIFECYCLE_STATUSES[number];
/** Omitted/empty preserves the existing unfiltered executor contract. */
export function parseJobStatuses(value:unknown):JobLifecycleStatus[]|null{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>JOB_LIFECYCLE_STATUSES.length||value.some(v=>typeof v!=='string'||!JOB_LIFECYCLE_STATUSES.includes(v as JobLifecycleStatus))||new Set(value).size!==value.length)return null;
 return JOB_LIFECYCLE_STATUSES.filter(status=>value.includes(status));
}
export function matchesJobPopulation(job:{archived:boolean;effective:{status:string}},selection:{statuses:readonly string[];includeArchived:boolean}){
 return (selection.includeArchived||!job.archived)&&(!selection.statuses.length||selection.statuses.includes(job.effective.status));
}
