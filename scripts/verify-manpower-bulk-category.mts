import assert from 'node:assert/strict';
import { supabase } from '../src/lib/supabase';
import { updateManpowerProductCategory, MAX_BULK_PRODUCT_ENTRIES } from '../src/modules/manpower/manpower';

// No HTTP requests: exercise the actual client function against a query-builder double.
const original = supabase.from;
const requests: { payload: unknown; ids?: string[] }[] = [];
let result: { data: unknown; error: unknown; count: number | null };
supabase.from = (() => ({
  update(payload: unknown, options: unknown) {
    assert.deepEqual(options, {count:'exact'});
    const request: {payload:unknown;ids?:string[]}={payload};requests.push(request);
    return { in(column:string, ids:string[]) {
      assert.equal(column,'id');request.ids=ids;
      return {select: async()=>result};
    }};
  },
})) as unknown as typeof supabase.from;
try {
  await assert.rejects(updateManpowerProductCategory([], 'slabs'), /Select at least/);
  await assert.rejects(updateManpowerProductCategory(Array.from({length:MAX_BULK_PRODUCT_ENTRIES+1},(_,i)=>String(i)), 'slabs'), /No request was sent/);
  await assert.rejects(updateManpowerProductCategory(['a'], ''), /active Product/);
  assert.equal(requests.length,0);
  result={data:[{id:'a',product_category_id:'slabs'},{id:'b',product_category_id:'slabs'}],error:null,count:2};
  assert.equal((await updateManpowerProductCategory(['a','b','a'],'slabs')).length,2);
  assert.deepEqual(requests.pop(),{payload:{product_category_id:'slabs'},ids:['a','b']});
  for(const bad of [
    {data:[{id:'a',product_category_id:'slabs'}],error:null,count:1},
    {data:[{id:'a',product_category_id:'slabs'},{id:'a',product_category_id:'slabs'}],error:null,count:2},
    {data:[{id:'a',product_category_id:'slabs'},{id:'wrong',product_category_id:'slabs'}],error:null,count:2},
    {data:[{id:'a',product_category_id:'slabs'},{id:'b',product_category_id:null}],error:null,count:2},
    {data:[{id:'a',product_category_id:'slabs'},{id:'b',product_category_id:'slabs'}],error:null,count:null},
  ]) {result=bad;await assert.rejects(updateManpowerProductCategory(['a','b'],'slabs'),/not confirmed/);}
  result={data:null,error:new Error('inactive category'),count:null};
  await assert.rejects(updateManpowerProductCategory(['a','b'],'slabs'),/inactive category/);
  assert.equal(requests.length,6,'exactly one request per application; no automatic retry/chunking');
  console.log('Bulk category client checks passed: bound/deduplication, exact payload, one PATCH, errors, omitted/duplicate/wrong IDs, wrong assignment and unverifiable count.');
} finally {supabase.from=original;}
