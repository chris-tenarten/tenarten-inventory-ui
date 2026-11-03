/** Metadata compatibility for additive status/schedule read selectors. Descriptions
 * remain current for discovery; history binds the same read authority. This
 * exact bridge changes no tool identity/kind, hard boundary, source proof or RLS.
 * Unknown future descriptors are deliberately not normalized. */
const bridges=[
  {
    "name": "find_jobs",
    "legacy": "Find caller-visible canonical Production Jobs by exact number/name or bounded search. Never choose an ambiguous match. Empty query/cursor means browse/start; limit 1–20; archived only when explicitly requested.",
    "current": "List/search caller-visible canonical Production Jobs. statuses selects a union of current effective lifecycle statuses, including active Rework; [] means all statuses. Use query \"\" to enumerate by status; query is only a Job number/name/customer search, never a status label. The same statuses/include_archived population is available to get_production_overview. include_archived=false excludes archives; true includes them. Filter before pagination, limit 1–20; cursor \"\" starts. Follow next_cursor until has_more=false. A 1,000-Job scan/deadline bound can make results incomplete; never report incomplete retrieval as zero. Never choose an ambiguous identity.",
    "schedule": "List/search caller-visible canonical Production Jobs. statuses selects effective lifecycle statuses including active Rework; [] means all statuses, including terminal statuses. schedule is all, scheduled (both effective saved planned dates), or unscheduled (either date missing). Use query \"\" to enumerate a population; query is only a Job number/name/customer search, never a status or schedule label. The same statuses/schedule/include_archived population is available to get_production_overview. include_archived=false excludes archives; true includes them. Filters precede pagination, limit 1–20; cursor \"\" starts. Follow next_cursor until has_more=false, and preserve page/completeness facts. A 1,000-Job scan/deadline bound can make results incomplete; never report incomplete retrieval as zero. Resolve identity with statuses [] and schedule all; population filters cannot establish name uniqueness. A unique complete name search resolves a canonical Job; ambiguous matches require clarification."
  },
  {
    "name": "get_production_overview",
    "legacy": "Read bounded caller-visible current Job counts, active statuses and upcoming saved finishes. Empty dates use canonical upcoming Chicago window. Counts are current, not historical completion events.",
    "current": "Count the same current caller-visible canonical Job population as find_jobs: identical statuses/include_archived selectors, effective active-Rework status, [] means all statuses; include_archived=false excludes archives and true includes them. counts.jobs is the selected population; unselected by_status entries are null, never global zero. Active Jobs exclude archives and terminal statuses. A 1,000-Job scan/deadline bound can prevent exact counts; preserve incomplete/unknown results. Dates affect only upcoming saved finishes (both empty uses Chicago window), not historical status events; limit bounds upcoming rows, not counts.",
    "schedule": "Count the same caller-visible canonical Job population as find_jobs: identical statuses/schedule/include_archived selectors and effective active-Rework values. [] means all lifecycle statuses, including terminal statuses. schedule is all, scheduled (both effective saved planned dates), or unscheduled (either date missing). include_archived=false excludes archives and true includes them. counts.jobs is this selected population; unselected by_status entries are null, never global zero. Active Jobs exclude archives and terminal statuses; this is distinct from all Jobs or the Pipeline attention population. A 1,000-Job scan/deadline bound can prevent exact counts; preserve incomplete/unknown results. Dates affect only upcoming saved finishes (both empty uses Chicago window), not historical status events; limit bounds upcoming rows, not counts."
  }
] as const;
export function canonicalHistoryScope(value:unknown):unknown {
 if(!value||typeof value!=='object'||Array.isArray(value))return value;
 const scope=value as Record<string,unknown>;if(!Array.isArray(scope.capabilities))return value;
 return {...scope,capabilities:scope.capabilities.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))return item;const capability=item as Record<string,unknown>;
  const bridge=bridges.find(b=>capability.name===b.name&&capability.kind==='read'&&(capability.description===b.current||capability.description===b.schedule));
  return bridge?{...capability,description:bridge.legacy}:item;
 })};
}
