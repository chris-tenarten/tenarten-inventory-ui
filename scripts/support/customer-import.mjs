import assert from 'node:assert/strict';
export const normalizeCustomerName = value => typeof value === 'string' ? value.trim() : '';
export const customerNameKey = value => normalizeCustomerName(value).toLowerCase();

/** Complete stable offset pagination, advancing by actual rows (not requested size). */
export async function loadCompleteCustomerRows(fetchPage, pageSize = 500) {
  const rows=[],pages=[],seen=new Set();let total=null;
  for (;;) {
    const start=rows.length;
    const result=await fetchPage(start,start+pageSize-1);
    if(result.error)throw result.error;
    assert(Number.isInteger(result.count)&&result.count>=0,'Exact count required to prove complete retrieval');
    if(total===null)total=result.count;
    assert.equal(result.count,total,'Dataset count changed during preview; rerun discovery');
    assert(Array.isArray(result.data),'Expected paginated rows');
    pages.push({offset:start,rows:result.data.length,total:result.count});
    for(const row of result.data){assert(!seen.has(row.id),'Repeated row during pagination');seen.add(row.id);rows.push(row);}
    assert(rows.length<=total,'Row count exceeded advertised total');
    if(result.data.length===0){assert.equal(rows.length,total,'Truncated/empty page before advertised total');break;}
    // Read the terminal empty page too; this also catches silent server row limits.
  }
  return {rows,total,pages};
}

/** Strict names only. Heuristic warnings are review holds, never fuzzy merges. */
export function buildCustomerImportPreview(jobs,companies=[]) {
 const groups=new Map(),invalid=[];
 for(const job of jobs){
  const name=normalizeCustomerName(job.customer);
  if(!name){invalid.push({reason:job.customer==null?'null':'blank'});continue;}
  const key=customerNameKey(name);
  if(!groups.has(key))groups.set(key,{key,variants:new Map(),usage:0,activeJobs:0,archivedJobs:0});
  const g=groups.get(key);g.usage++;g[job.archived_at?'archivedJobs':'activeJobs']++;
  g.variants.set(job.customer,(g.variants.get(job.customer)||0)+1);
 }
 const directory=new Map();
 for(const company of companies){const key=customerNameKey(company.name);if(!directory.has(key))directory.set(key,[]);directory.get(key).push(company);}
 const identities=[...groups.values()].map(g=>{
  const displayCounts=new Map();for(const [raw,count] of g.variants){const display=normalizeCustomerName(raw);displayCounts.set(display,(displayCounts.get(display)||0)+count);}
  const name=[...displayCounts].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0))[0][0];
  const matches=directory.get(g.key)||[],warnings=[];
  if(/\btemporary\b|\binternal\s+test\b|\bnot\s+a\s+customer\b/i.test(name))warnings.push('Temporary/test label: verify whether this is a real customer');
  if(name.length>300)warnings.push('Name exceeds directory limit (300 characters)');
  if(/[\u0000-\u001f\u007f]/.test(name))warnings.push('Embedded control characters');
  if(/^(?:n\/?a|none|null|unknown|tbd|tba|test|customer|no customer|not specified|-)$/i.test(name))warnings.push('Placeholder or unclear company identity');
  // Keep Unicode case/whitespace semantics out of an unreviewed automatic identity mapping.
  if(/[^\x20-\x7e]/.test(name))warnings.push('Non-ASCII identity: review normalization explicitly');
  if(matches.length>1)warnings.push('Multiple existing directory records share this normalized name');
  const status=warnings.length?'manual_review':matches.length===1?(matches[0].archived_at?'archived_excluded':'already_configured'):'safe_new';
  return {name,key:g.key,usage:g.usage,activeJobs:g.activeJobs,archivedJobs:g.archivedJobs,status,warnings,
   variants:[...g.variants].map(([value,count])=>({value,count})).sort((a,b)=>b.count-a.count||(a.value<b.value?-1:1)),
   caseWhitespaceDuplicate:g.variants.size>1||[...g.variants.keys()].some(raw=>raw!==normalizeCustomerName(raw)),
   existing:matches.map(c=>({id:c.id,name:c.name,archived: Boolean(c.archived_at)}))};
 }).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
 const rawStrings=new Set(jobs.filter(j=>typeof j.customer==='string').map(j=>j.customer));
 return {counts:{historicalJobs:jobs.length,activeJobs:jobs.filter(j=>!j.archived_at).length,archivedJobs:jobs.filter(j=>j.archived_at).length,
  distinctCustomerStrings:rawStrings.size,distinctNonblankStrings:new Set(jobs.map(j=>j.customer).filter(v=>normalizeCustomerName(v))).size,
  normalizedIdentities:identities.length,alreadyConfigured:identities.filter(i=>i.status==='already_configured').length,
  proposed:identities.filter(i=>i.status==='safe_new').length,excludedIdentities:identities.filter(i=>i.status==='archived_excluded').length,
  invalidBlankJobs:invalid.length,manualReview:identities.filter(i=>i.status==='manual_review').length,
  duplicateGroups:identities.filter(i=>i.caseWhitespaceDuplicate).length,existingConfiguredRecords:companies.length},identities,
  proposedNames:identities.filter(i=>i.status==='safe_new').map(i=>i.name),invalidBlankValues:invalid};
}
