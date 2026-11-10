/** Read all pages without silently accepting a truncated or changing result set.
 * Callers must request an exact count and a deterministic order ending in id.
 * This detects count/membership drift, not a transactional database snapshot. */
export async function loadCompleteRows<T extends { id: string }>(fetchPage: (from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null;count:number|null}>):Promise<T[]> {
  const rows:T[]=[],seen=new Set<string>();let expected:number|null=null;
  while(true){
    const page=await fetchPage(rows.length,rows.length+499);
    if(page.error)throw new Error(page.error.message);
    if(page.count===null)throw new Error('Unable to verify complete planning data. Refresh and retry.');
    expected??=page.count;
    if(expected!==page.count)throw new Error('Planning records changed while loading. Refresh and retry.');
    for(const row of page.data??[]){if(seen.has(row.id))throw new Error('Planning records changed while loading. Refresh and retry.');seen.add(row.id);rows.push(row);}
    if(rows.length===expected)return rows;
    if(!page.data?.length||rows.length>expected)throw new Error('Planning data is incomplete. Refresh and retry.');
  }
}
