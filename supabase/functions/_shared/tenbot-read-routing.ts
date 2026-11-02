/** Conservative dispatch only. The existing registry still owns every read;
 * unfamiliar wording and compound goals go to model-selected orchestration. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import {explicitJobReferences,type JobIntent} from './tenbot-job-routing.ts';

const common=new Set('what is are there the a an for of on in at to from through between during this last past next today tomorrow week month year days day please show give me tell about current currently saved recorded persisted job jobs project projects production it its that those these them their same all active archived non unarchived include including exclude excluding with without marked by'.split(' '));
const vocabulary:Record<string,Set<string>>={
 find_jobs:new Set('list find search enumerate which names ones status statuses not started in progress complete completed on hold cancelled canceled rework deck and or'.split(' ')),
 get_production_overview:new Set('how many count counts overview shop status statuses not started in progress complete completed on hold cancelled canceled rework deck and or'.split(' ')),
 get_job_summary:new Set('status summary material materials readiness ready follow up ups unresolved'.split(' ')),
 get_job_planning:new Set('schedule scheduled planning planned dates date start end finish'.split(' ')),
 get_job_labor_summary:new Set('how much many labor labour manpower hours hour total totals'.split(' ')),
};
/** A matching intent is insufficient: consume the whole request vocabulary so
 * a second goal cannot disappear behind the first matching deterministic tool.
 * False negatives cost an inference attempt, never silently lose a request. */
export function isSimpleJobRead(question:string,intent:JobIntent|null):boolean{
 if(!intent||!('tool' in intent)||intent.kind==='jobs')return false;
 let rest=question.replace(/["“][^"”\n]*["”]/g,' ');
 for(const reference of explicitJobReferences(question))rest=rest.replaceAll(reference,' ');
 rest=rest.replace(/\b\d{4}-\d\d-\d\d\b/g,' ');
 if(/[\n;:,]|\?(?=\s*\S)/.test(rest)||/\b(?:and|or|also|plus|then)\b/i.test(rest))return false;
 if(/\bhow many\b.*\bhow many\b|\b(?:list|find|search|enumerate)\b.*\b(?:list|find|search|enumerate)\b/i.test(rest))return false;
 const allowed=vocabulary[intent.tool];
 const words=rest.toLowerCase().replace(/[?.!,#'’_-]/g,' ').trim().split(/\s+/).filter(Boolean);
 return words.length>0&&words.every(word=>common.has(word)||allowed.has(word)||/^\d{1,3}$/.test(word));
}

export const CONVERSATIONAL_READ_UNAVAILABLE='I could not complete this full request right now. You can still ask one direct Job count, status, schedule or labor question at a time, or retry the full briefing later.';
