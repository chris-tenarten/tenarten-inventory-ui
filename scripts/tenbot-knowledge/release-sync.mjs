/** Pure offline impact analysis. A report never approves a release or advances a pin. */
import {createHash} from 'node:crypto';
const sensitivePath=path=>/^supabase\/migrations\//.test(path)
 ||/^src\/(?:lib\/rbac\.ts|components\/BusinessWriteControls\.tsx)$/.test(path)
 ||/^supabase\/functions\/(?:_shared\/tenbot-[a-z-]+\.ts|tenbot\/index\.ts)$/.test(path)
 ||path==='supabase/functions/tenbot-receival-cleanup/index.ts'
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

const fullHash=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const candidateKindPath=(kind,path)=>typeof path==='string'&&!path.includes('..')&&(kind==='unapplied-migration'
 ?/^supabase\/migrations\/[0-9]{14}_[a-z0-9_]+\.sql$/.test(path)
 :kind==='runtime'&&path!=='supabase/functions/_shared/tenbot-knowledge-snapshot.ts'
  &&(isInfrastructurePath(path)||path==='supabase/functions/tenbot-receival-cleanup/index.ts'));
/** Exact candidate evidence is separate from executed-release/knowledge authority. */
export const candidateSourceReceiptLine=review=>`| ${review.path} | ${review.blob} | ${review.sha256} | ${review.authority} | ${review.kind} | ${review.acceptedAuthorityRevision??'none'} |`;
export function verifyCandidateSourceReview(review,candidateRevision,{fullRevision,pathBlob,readCommitted,committedReviewSection}){
 const required=['classification','authority','kind','path','blob','sha256','reviewedCandidate','scope','receipt'];
 const accepted=review?.authority==='product-accepted',allowed=[...required,...(accepted?['acceptedAuthorityRevision']:[])];
 if(!review||required.some(key=>!Object.hasOwn(review,key))||Object.keys(review).some(key=>!allowed.includes(key))
  ||review.classification!=='candidate-source'||!['product-accepted','technical-review'].includes(review.authority)
  ||review.scope!=='tendev-preparation'||!candidateKindPath(review.kind,review.path)
  ||!fullHash(review.blob)||!fullHash(review.reviewedCandidate)||typeof review.sha256!=='string'||!/^[a-f0-9]{64}$/.test(review.sha256)
  ||accepted&&!fullHash(review.acceptedAuthorityRevision))throw Error('Invalid exact candidate-source review.');
 if(!fullHash(candidateRevision))throw Error('Candidate-source review requires the full candidate revision.');
 if(!review.receipt||Object.keys(review.receipt).sort().join(',')!=='heading,path,revision'||typeof review.receipt.path!=='string'||!/^docs\/[a-zA-Z0-9_/-]+\.md$/.test(review.receipt.path)||review.receipt.path.includes('..')||!fullHash(review.receipt.revision)||typeof review.receipt.heading!=='string')throw Error('Candidate-source review requires a scoped committed receipt.');
 const reviewedCandidate=fullRevision(review.reviewedCandidate),receiptRevision=fullRevision(review.receipt?.revision);
 if(reviewedCandidate!==receiptRevision)throw Error('Candidate-source review and reviewed source must belong to the same committed tree.');
 const section=committedReviewSection(review.receipt),heading=review.receipt.heading;
 const requiredLines=['Scope: tendev-preparation.','This review is not evidence of hosted application or deployment.',
  'This review grants no migration application, write activation, push or deployment authority.',candidateSourceReceiptLine(review)];
 if(!requiredLines.every(line=>section.split('\n').some(value=>value.trim()===line)))throw Error('Candidate-source receipt must bind its exact bytes, authority and preparation-only scope.');
 if(accepted){
  const acceptedAuthorityRevision=fullRevision(review.acceptedAuthorityRevision);
  if(!heading.startsWith('## Accepted candidate source review')||!section.split('\n').some(line=>/^\s*(?:\*\*)?Chris (?:explicitly )?(?:accepts|approves)\b/i.test(line)&&line.includes(acceptedAuthorityRevision)))throw Error('Accepted candidate-source review requires explicit Product acceptance of its source authority revision.');
  if(pathBlob(acceptedAuthorityRevision,review.path)!==review.blob)throw Error('Accepted authority revision does not contain the accepted candidate-source bytes.');
 }else if(!heading.startsWith('## Candidate technical source review')||!section.split('\n').some(line=>line.trim()==='Product acceptance remains pending for these technical changes.'))throw Error('Technical candidate-source review must retain pending Product acceptance.');
 if(pathBlob(reviewedCandidate,review.path)!==review.blob
  ||createHash('sha256').update(readCommitted(reviewedCandidate,review.path)).digest('hex')!==review.sha256)throw Error('Reviewed candidate-source Git blob or SHA-256 differs from its committed source.');
 const candidateBlob=pathBlob(candidateRevision,review.path);
 if(candidateBlob!==review.blob)return {review:null,hold:{path:review.path,reason:'candidate-source-proof-changed'}};
 if(createHash('sha256').update(readCommitted(candidateRevision,review.path)).digest('hex')!==review.sha256)throw Error('Candidate-source SHA-256 differs from its exact reviewed bytes.');
 return {review:{...review,reviewedCandidate,receipt:{...review.receipt,revision:receiptRevision},verifiedForCandidate:candidateRevision},hold:null};
}
export function assertCandidatePreparationTarget(candidateSources,{releaseBuild,cfPagesUrl,cfPagesBranch}){
 if(releaseBuild&&candidateSources.length&&(cfPagesUrl!=='https://tendev.pages.dev'||cfPagesBranch!=='dev'))throw Error('Candidate-source evidence authorizes TenDev preparation only; the exact TenDev URL and dev build branch are required.');
}
export function resolveCandidateSourceEvidence({candidateSources,candidateChanges=[],historical,historicalChanges=[],holds}){
 if(new Set(candidateSources.map(review=>review.path)).size!==candidateSources.length)throw Error('Candidate-source reviews must be unique for each exact current path.');
 if(candidateSources.some(review=>review.kind==='unapplied-migration'&&historical.some(old=>old.path===review.path)))throw Error('Unapplied migration evidence conflicts with original executed deployment evidence.');
 const supersededHistorical=historicalChanges.flatMap(({review,hold})=>{
  const replacement=candidateSources.find(source=>source.kind==='runtime'&&source.path===review.path);
  return replacement?[{historicalReview:review,candidateSource:replacement,hold}]:[];
 });
 const supersededCandidateSources=candidateChanges.flatMap(({review,hold})=>{
  const replacement=candidateSources.find(source=>source.kind===review.kind&&source.path===review.path);
  return replacement?[{previousCandidateSource:review,candidateSource:replacement,hold}]:[];
 });
 const resolved=[...supersededHistorical,...supersededCandidateSources];
 return {candidateSources,
  supersededHistorical:supersededHistorical.map(({historicalReview,candidateSource})=>({historicalReview,candidateSource})),
  supersededCandidateSources:supersededCandidateSources.map(({previousCandidateSource,candidateSource})=>({previousCandidateSource,candidateSource})),
  holds:holds.filter(hold=>!resolved.some(row=>row.hold===hold))};
}
export function resolveRecordReviewSupersessions({recordReviews,recordChanges,holds}){
 const supersededRecords=recordChanges.flatMap(({review,hold})=>{
  if(hold.reason!=='candidate-source-changed')return [];
  const replacement=recordReviews.find(current=>current.recordId===review.recordId&&current.path===review.path
   &&current.beforeBlob===review.beforeBlob&&current.recordDigest===review.recordDigest);
  return replacement?[{previousRecordReview:review,recordReview:replacement,hold}]:[];
 });
 return {supersededRecords:supersededRecords.map(({previousRecordReview,recordReview})=>({previousRecordReview,recordReview,previousDependenciesActive:false})),
  holds:holds.filter(hold=>!supersededRecords.some(row=>row.hold===hold))};
}
export function evaluateRecordReviewCandidate(review,{recordDigest,candidateBlob,additionalDependenciesMatch}){
 const originalSourceUnchanged=candidateBlob===review.beforeBlob,selectedSource=candidateBlob===review.afterBlob;
 return {inapplicable:originalSourceUnchanged,reasons:[...(recordDigest!==review.recordDigest?['record-content-or-authority-changed']:[]),
  ...(!originalSourceUnchanged&&!selectedSource?['candidate-source-changed']:[]),
  ...(selectedSource&&!additionalDependenciesMatch?['additional-dependency-changed']:[])]};
}

/**
 * changedBindings allows the CLI to compare every file with its own reviewed
 * release baseline. changedPaths is convenient for deterministic fixture tests.
 * @param {{id:string,reviewDigest?:string,relatedRecordIds?:string[],dependencyBindings?:{path:string,kind?:string}[]}[]} records
 * @param {{candidateRevision?:string|null,changedPaths?:string[],changedBindings?:{recordId:string,path:string,kind?:string,before?:string,after?:string|null}[]|null,acknowledgedInfrastructurePaths?:string[],verifiedRecordReviews?:any[],historicalDeployedPaths?:string[],verifiedCandidateSources?:any[],derivedArtifactPaths?:string[],sourceReviewHolds?:any[]}} [options]
 */
export function buildImpactReport(records,{candidateRevision=null,changedPaths=[],changedBindings=null,acknowledgedInfrastructurePaths=[],verifiedRecordReviews=[],historicalDeployedPaths=[],verifiedCandidateSources=[],derivedArtifactPaths=[],sourceReviewHolds=[]}={}){
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
 const candidateSources=verifiedCandidateSources.filter(review=>review.classification==='candidate-source'&&review.scope==='tendev-preparation'
  &&fullHash(candidateRevision)&&review.verifiedForCandidate===candidateRevision&&candidateKindPath(review.kind,review.path)
  &&['product-accepted','technical-review'].includes(review.authority)&&fullHash(review.blob)&&typeof review.sha256==='string'&&/^[a-f0-9]{64}$/.test(review.sha256)&&paths.includes(review.path));
 // These acknowledgments resolve only unbound source impact. They cannot establish
 // an employee knowledge claim, clear semantic holds or advance a deployed pin.
 const candidatePaths=candidateSources.filter(review=>!classified.has(review.path)&&!boundSemanticPaths.has(review.path)).map(review=>review.path);
 const derived=paths.filter(path=>path==='supabase/functions/_shared/tenbot-knowledge-snapshot.ts'&&!classified.has(path)&&derivedArtifactPaths.includes(path));
 const unclassifiedSensitivePaths=paths.filter(path=>sensitivePath(path)&&!classified.has(path)&&!acknowledged.includes(path)&&!historical.includes(path)&&!candidatePaths.includes(path)&&!derived.includes(path));
 const reviewRequired=semanticIds.length>0||unclassifiedSensitivePaths.length>0||sourceReviewHolds.length>0;
 const unresolved=new Set([...semanticIds,...sourceReviewHolds.flatMap(hold=>hold.recordId?[hold.recordId]:[])]),pending=[...unresolved];
 while(pending.length){const id=pending.shift();for(const next of neighbors.get(id)??[])if(!unresolved.has(next)){unresolved.add(next);pending.push(next);}}
 const extractionNeeded=changes.some(change=>change.kind==='interface');
 const reviewed=reviewedChanges.length>0||acknowledged.length>0||historical.length>0||derived.length>0;
 return {schemaVersion:1,candidateRevision,status:reviewRequired?'review-required':extractionNeeded?'extraction-refresh-needed':candidateSources.length?'candidate-preparation-reviewed':reviewed?'reviewed':'unchanged',reviewRequired,
  changedPaths:paths,directlyAffected:[...directlyAffected].sort(([a],[b])=>a.localeCompare(b)).map(([id,changes])=>({id,changes})),
  affectedRecordIds:[...affected].sort(),dependentRecordIds:[...affected].filter(id=>!directlyAffected.has(id)).sort(),
  semanticRecordIds:semanticIds,extractionOnlyRecordIds:[...directlyAffected].filter(([,changes])=>changes.every(change=>change.kind==='interface')).map(([id])=>id).sort(),
  reviewedSemanticRecordIds:[...new Set(reviewedChanges.map(change=>change.recordId))].sort(),unresolvedAffectedRecordIds:[...unresolved].sort(),resolvedAffectedRecordIds:[...affected].filter(id=>!unresolved.has(id)).sort(),
  unclassifiedSensitivePaths,acknowledgedInfrastructurePaths:acknowledged,reviewedRecordChanges:reviewedChanges,historicalDeployedPaths:historical,
  candidateSourcePaths:[...new Set(candidatePaths)].sort(),acceptedCandidateSources:candidateSources.filter(review=>review.authority==='product-accepted'),technicalCandidateSources:candidateSources.filter(review=>review.authority==='technical-review'),
  candidateSourceAuthority:{scope:candidateSources.length?'tendev-preparation':null,requiresProductAcceptance:candidateSources.some(review=>review.authority==='technical-review'),hostedApplicationVerified:false,deploymentAuthorized:false},
  derivedArtifactPaths:derived,sourceReviewHolds,
  limitation:'Offline comparison against reviewed source pins. Semantic changes require source/permission/approval review; this report grants no Product acceptance, database authority, push or deployment authorization. Extraction refresh never advances a release pin automatically.'};
}
