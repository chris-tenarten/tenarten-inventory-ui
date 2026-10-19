import { loadCompleteRows } from './complete-rows';

/** Bound PostgREST URL scopes while retaining complete authorized results.
 * Undefined keeps legacy all-record callers; [] intentionally performs no read. */
export async function loadScopedRows<T extends { id: string }>(
  ids: string[] | undefined,
  fetchPage: (scope: string[] | undefined, from: number, to: number) => PromiseLike<{data:T[]|null;error:{message:string}|null;count:number|null}>,
): Promise<T[]> {
  const unique = ids ? [...new Set(ids)] : undefined;
  const scopes = unique ? Array.from({length:Math.ceil(unique.length/200)},(_,i)=>unique.slice(i*200,i*200+200)) : [undefined];
  const rows:T[]=[];
  for (const scope of scopes) rows.push(...await loadCompleteRows((from,to)=>fetchPage(scope,from,to)));
  return rows;
}
