/** Pure offline impact analysis. A report never approves a release or advances a pin. */
const sensitivePath=path=>/^supabase\/migrations\//.test(path)
 ||/^src\/(?:lib\/rbac\.ts|components\/BusinessWriteControls\.tsx)$/.test(path)
 ||/^supabase\/functions\/(?:_shared\/tenbot-[a-z-]+\.ts|tenbot\/index\.ts)$/.test(path)
 ||/^supabase\/functions\/_shared\/(?:rbac\.ts|bid-scope-handler\.ts|sample-(?:ratio|batch-first|batch-projection|production-batch)\.mjs)$/.test(path)
 ||/^supabase\/functions\/generate-(?:purchase-order|proposal|sample)-pdf\//.test(path)
 ||/^scripts\/(?:generate-tenbot-knowledge\.mjs|tenbot-knowledge\/(?:architecture|manifest|release-sync)\.mjs)$/.test(path);

export const isInfrastructurePath=path=>/^supabase\/functions\/(?:_shared\/tenbot-[a-z-]+\.ts|tenbot\/index\.ts)$/.test(path)
 ||/^scripts\/(?:generate-tenbot-knowledge\.mjs|tenbot-knowledge\/(?:architecture|manifest|release-sync)\.mjs)$/.test(path);

export const isInfrastructureReviewHeading=heading=>typeof heading==='string'&&heading.startsWith('## ')
 &&['accepted','infrastructure','review'].every(word=>heading.toLowerCase().split(/[^a-z]+/).includes(word));
export const isRecordReviewPath=path=>typeof path==='string'&&!path.includes('..')&&!/^supabase\/migrations\//.test(path)
 &&!/^src\/(?:lib\/rbac\.ts|components\/BusinessWriteControls\.tsx)$/.test(path)
 &&(/^(?:src\/|docs\/)/.test(path)||/^supabase\/functions\/_shared\/(?:production-job-facts|labor-hours)\.mjs$/.test(path));
/** Receipt verification happens in the CLI; this pure check binds its decision. */
export function matchesRecordReview(record,change,review){
 return review.classification==='record-no-claim-impact'&&isRecordReviewPath(change.path)
  &&change.kind==='semantic'&&typeof change.after==='string'&&change.before!==change.after
  &&review.recordId===record.id&&review.path===change.path&&review.beforeBlob===change.before
  &&review.afterBlob===change.after&&review.recordDigest===record.reviewDigest;
}

/**
 * changedBindings allows the CLI to compare every file with its own reviewed
 * release baseline. changedPaths is convenient for deterministic fixture tests.
 * @param {{id:string,reviewDigest?:string,relatedRecordIds?:string[],dependencyBindings?:{path:string,kind?:string}[]}[]} records
 * @param {{candidateRevision?:string|null,changedPaths?:string[],changedBindings?:{recordId:string,path:string,kind?:string,before?:string,after?:string|null}[]|null,acknowledgedInfrastructurePaths?:string[],verifiedRecordReviews?:any[],historicalDeployedPaths?:string[],derivedArtifactPaths?:string[],sourceReviewHolds?:any[]}} [options]
 */
export function buildImpactReport(records,{candidateRevision=null,changedPaths=[],changedBindings=null,acknowledgedInfrastructurePaths=[],verifiedRecordReviews=[],historicalDeployedPaths=[],derivedArtifactPaths=[],sourceReviewHolds=[]}={}){
 const paths=[...new Set(changedPaths)].sort(),byId=new Map(records.map(record=>[record.id,record]));
 const changes=changedBindings??records.flatMap(record=>(record.dependencyBindings??[])
  .filter(binding=>paths.includes(binding.path)).map(binding=>({recordId:record.id,...binding})));
 const directlyAffected=new Map();
 for(const change of changes){
  if(!byId.has(change.recordId))throw Error(`Unknown affected knowledge record: ${change.recordId}`);
  const list=directlyAffected.get(change.recordId)??[];
  list.push({path:change.path,kind:change.kind??'semantic',...(change.before?{before:change.before}:{}),...(Object.hasOwn(change,'after')?{after:change.after}:{})});
  directlyAffected.set(change.recordId,list);
 }
 // Relationships are a conservative review graph, not permission or execution edges.
 const neighbors=new Map(records.map(record=>[record.id,new Set()]));
 for(const record of records)for(const related of record.relatedRecordIds??[]){
  if(!byId.has(related))throw Error(`Unknown related knowledge record: ${record.id} → ${related}`);
  neighbors.get(record.id).add(related);neighbors.get(related).add(record.id);
 }
 const affected=new Set(directlyAffected.keys()),queue=[...affected];
 while(queue.length){const id=queue.shift();for(const next of neighbors.get(id))if(!affected.has(next)){affected.add(next);queue.push(next);}}
 const reviewedChanges=[];
 const semanticIds=[...directlyAffected].filter(([id,changes])=>changes.filter(change=>{
  if(change.kind!=='semantic')return false;
  const matched=verifiedRecordReviews.find(review=>matchesRecordReview(byId.get(id),change,review));
  if(matched){reviewedChanges.push({recordId:id,...change,classification:'record-no-claim-impact'});return false;}
  return true;
 }).length>0).map(([id])=>id).sort();
 const classified=new Set(changes.map(change=>change.path));
 const boundSemanticPaths=new Set(records.flatMap(record=>(record.dependencyBindings??[]).filter(binding=>binding.kind!=='interface').map(binding=>binding.path)));
 const acknowledged=paths.filter(path=>sensitivePath(path)&&!classified.has(path)&&isInfrastructurePath(path)&&!boundSemanticPaths.has(path)&&acknowledgedInfrastructurePaths.includes(path));
 const historical=paths.filter(path=>sensitivePath(path)&&!classified.has(path)&&historicalDeployedPaths.includes(path));
 const derived=paths.filter(path=>path==='supabase/functions/_shared/tenbot-knowledge-snapshot.ts'&&!classified.has(path)&&derivedArtifactPaths.includes(path));
 const unclassifiedSensitivePaths=paths.filter(path=>sensitivePath(path)&&!classified.has(path)&&!acknowledged.includes(path)&&!historical.includes(path)&&!derived.includes(path));
 const reviewRequired=semanticIds.length>0||unclassifiedSensitivePaths.length>0||sourceReviewHolds.length>0;
 const unresolved=new Set([...semanticIds,...sourceReviewHolds.flatMap(hold=>hold.recordId?[hold.recordId]:[])]),pending=[...unresolved];
 while(pending.length){const id=pending.shift();for(const next of neighbors.get(id)??[])if(!unresolved.has(next)){unresolved.add(next);pending.push(next);}}
 const extractionNeeded=changes.some(change=>change.kind==='interface');
 const reviewed=reviewedChanges.length>0||acknowledged.length>0||historical.length>0||derived.length>0;
 return {schemaVersion:1,candidateRevision,status:reviewRequired?'review-required':extractionNeeded?'extraction-refresh-needed':reviewed?'reviewed':'unchanged',reviewRequired,
  changedPaths:paths,directlyAffected:[...directlyAffected].sort(([a],[b])=>a.localeCompare(b)).map(([id,changes])=>({id,changes})),
  affectedRecordIds:[...affected].sort(),dependentRecordIds:[...affected].filter(id=>!directlyAffected.has(id)).sort(),
  semanticRecordIds:semanticIds,extractionOnlyRecordIds:[...directlyAffected].filter(([,changes])=>changes.every(change=>change.kind==='interface')).map(([id])=>id).sort(),
  reviewedSemanticRecordIds:[...new Set(reviewedChanges.map(change=>change.recordId))].sort(),unresolvedAffectedRecordIds:[...unresolved].sort(),resolvedAffectedRecordIds:[...affected].filter(id=>!unresolved.has(id)).sort(),
  unclassifiedSensitivePaths,acknowledgedInfrastructurePaths:acknowledged,reviewedRecordChanges:reviewedChanges,historicalDeployedPaths:historical,derivedArtifactPaths:derived,sourceReviewHolds,
  limitation:'Offline comparison against reviewed source pins. Semantic changes require source/permission/approval review; this report grants no Product acceptance, database authority, push or deployment authorization. Extraction refresh never advances a release pin automatically.'};
}
