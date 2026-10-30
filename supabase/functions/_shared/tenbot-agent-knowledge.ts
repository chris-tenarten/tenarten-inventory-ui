// Both inference paths consume the same reviewed generated patches and IDs.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno source
// @ts-ignore -- Deno requires explicit extensions.
import {knowledgeEntries,registry,snapshot,type CapabilityEntry} from './tenbot-knowledge.ts';

export const agentKnowledgeSnapshot=snapshot;
export function agentKnowledgeEntries():CapabilityEntry[]{
 return [...new Map([...registry,...knowledgeEntries].map(entry=>[entry.id,entry])).values()];
}
