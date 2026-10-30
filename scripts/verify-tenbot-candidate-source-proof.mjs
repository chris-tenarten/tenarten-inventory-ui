/** Focused release-proof tests. No shared Git, database, provider or hosted calls. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,symlinkSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assertCandidatePreparationTarget,buildImpactReport,candidateSourceReceiptLine,evaluateRecordReviewCandidate,resolveCandidateSourceEvidence,resolveRecordReviewSupersessions,verifyCandidateSourceReview} from './tenbot-knowledge/release-sync.mjs';

const hash=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const blob=bytes=>hash('sha1',Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(bytes)}\0`),Buffer.from(bytes)]));
const authority='a'.repeat(40),reviewed='b'.repeat(40),candidate='c'.repeat(40),other='d'.repeat(40);
const migration='supabase/migrations/20261030190000_invoice_receival_pilot_policy_lock.sql';
const runtime='supabase/functions/_shared/tenbot-receival-cleanup.ts';
const fixture=({kind='unapplied-migration',accepted=true,path=kind==='runtime'?runtime:migration}={})=>{
 const bytes=kind==='runtime'?'export const safeFixture = true;\n':'-- Synthetic migration source only.\nselect 1;\n';
 const review={classification:'candidate-source',authority:accepted?'product-accepted':'technical-review',kind,path,blob:blob(bytes),sha256:hash('sha256',bytes),reviewedCandidate:reviewed,scope:'tendev-preparation',
  receipt:{path:'docs/project-memory/synthetic-candidate-source-review.md',revision:reviewed,heading:accepted?'## Accepted candidate source review — synthetic':'## Candidate technical source review — synthetic'},
  ...(accepted?{acceptedAuthorityRevision:authority}:{})};
 const section=[review.receipt.heading,'',accepted?`Chris accepts source authority revision ${authority}.`:'Product acceptance remains pending for these technical changes.','',
  'Scope: tendev-preparation.','This review is not evidence of hosted application or deployment.',
  'This review grants no migration application, write activation, push or deployment authority.','',candidateSourceReceiptLine(review),''].join('\n');
 const sources=new Map([authority,reviewed,candidate].map(revision=>[revision,new Map([[path,bytes]])]));
 const value={review,section,sources};
 value.proof={
  fullRevision:revision=>{assert.match(revision,/^[a-f0-9]{40}$/);assert(sources.has(revision),'Unknown full source revision');return revision;},
  pathBlob:(revision,sourcePath)=>sources.get(revision)?.has(sourcePath)?blob(sources.get(revision).get(sourcePath)):null,
  readCommitted:(revision,sourcePath)=>{const found=sources.get(revision)?.get(sourcePath);assert.notEqual(found,undefined,'Missing committed source');return found;},
  committedReviewSection:proof=>{assert.deepEqual(proof,review.receipt,'Missing or changed committed receipt');return value.section;}
 };
 return value;
};
const verify=(f,review=f.review)=>verifyCandidateSourceReview(review,candidate,f.proof);
const checks=[];
const check=(name,run)=>{run();checks.push(name);};

check('accepted but unapplied migration binds exact two hashes and original accepted source without deployed authority',()=>{
 const f=fixture(),result=verify(f);assert.equal(result.hold,null);assert.equal(result.review.verifiedForCandidate,candidate);
 const report=buildImpactReport([],{candidateRevision:candidate,changedPaths:[migration],verifiedCandidateSources:[result.review]});
 assert.equal(report.reviewRequired,false);assert.equal(report.status,'candidate-preparation-reviewed');assert.deepEqual(report.historicalDeployedPaths,[]);
 assert.equal(report.acceptedCandidateSources.length,1);assert.deepEqual(report.technicalCandidateSources,[]);
 assert.deepEqual(report.candidateSourceAuthority,{scope:'tendev-preparation',requiresProductAcceptance:false,hostedApplicationVerified:false,deploymentAuthorized:false});
});
check('technical runtime source retains pending Product acceptance',()=>{
 const f=fixture({kind:'runtime',accepted:false}),result=verify(f);
 const report=buildImpactReport([],{candidateRevision:candidate,changedPaths:[runtime],verifiedCandidateSources:[result.review]});
 assert.equal(report.reviewRequired,false);assert.equal(report.acceptedCandidateSources.length,0);assert.equal(report.technicalCandidateSources.length,1);
 assert.equal(report.candidateSourceAuthority.requiresProductAcceptance,true);assert.equal(report.candidateSourceAuthority.deploymentAuthorized,false);
});
check('cleanup Edge entry is sensitive and requires its own exact review',()=>{
 const path='supabase/functions/tenbot-receival-cleanup/index.ts';
 const unreviewed=buildImpactReport([],{candidateRevision:candidate,changedPaths:[path]});assert(unreviewed.reviewRequired);assert.deepEqual(unreviewed.unclassifiedSensitivePaths,[path]);
 const reviewed=verify(fixture({kind:'runtime',accepted:false,path})).review;
 const report=buildImpactReport([],{candidateRevision:candidate,changedPaths:[path],verifiedCandidateSources:[reviewed]});assert.equal(report.reviewRequired,false);assert.deepEqual(report.candidateSourcePaths,[path]);assert.equal(report.technicalCandidateSources.length,1);
});
check('strict shape, kind, path and scope cannot cover unrelated permissions or generated knowledge',()=>{
 const f=fixture();
 for(const review of [{...f.review,extra:true},{...f.review,scope:'production'},{...f.review,kind:'deployed-migration'},{...f.review,path:'supabase/migrations/../other.sql'},
  {...f.review,kind:'runtime',path:'src/lib/rbac.ts'},{...f.review,kind:'runtime',path:'supabase/functions/_shared/rbac.ts'},
  {...f.review,kind:'runtime',path:'supabase/functions/_shared/tenbot-knowledge-snapshot.ts'},{...f.review,classification:'historical-deployed'}])assert.throws(()=>verify(f,review),/Invalid exact candidate-source review/);
});
check('Product acceptance cannot be invented, inherited or supplied to technical-only source',()=>{
 const f=fixture();const {acceptedAuthorityRevision:_,...missing}=f.review;void _;
 assert.throws(()=>verify(f,missing),/Invalid exact/);
 const technical=fixture({accepted:false});assert.throws(()=>verify(technical,{...technical.review,acceptedAuthorityRevision:authority}),/Invalid exact/);
 f.section=f.section.replace(`Chris accepts source authority revision ${authority}.`,'The developer reviewed these bytes.');assert.throws(()=>verify(f),/explicit Product acceptance/);
 const stale=fixture();stale.sources.get(authority).set(migration,'-- Different accepted source.');assert.throws(()=>verify(stale),/Accepted authority revision/);
});
check('reviewed source and receipt require the same full committed tree',()=>{
 const f=fixture();assert.throws(()=>verify(f,{...f.review,reviewedCandidate:authority}),/same committed tree/);
 assert.throws(()=>verify(f,{...f.review,reviewedCandidate:'b'.repeat(7)}),/Invalid exact/);
 assert.throws(()=>verify(f,{...f.review,receipt:{...f.review.receipt,revision:other}}),/Unknown full/);
 assert.throws(()=>verify(f,{...f.review,receipt:{...f.review.receipt,path:'docs/../private.md'}}),/scoped committed receipt/);
 assert.throws(()=>verify(f,{...f.review,receipt:{...f.review.receipt,path:[f.review.receipt.path]}}),/scoped committed receipt/);
});
check('stale SHA, Git blob, receipt tuple and receipt authority are rejected',()=>{
 for(const mutation of ['sha','blob','tuple','authority']){
  const f=fixture();
  if(mutation==='sha'){f.review.sha256='e'.repeat(64);f.section=f.section.replace(hash('sha256',f.sources.get(reviewed).get(migration)),f.review.sha256);}
  if(mutation==='blob'){f.review.blob='e'.repeat(40);f.section=f.section.replace(blob(f.sources.get(reviewed).get(migration)),f.review.blob);}
  if(mutation==='tuple')f.section=f.section.replace(candidateSourceReceiptLine(f.review),candidateSourceReceiptLine({...f.review,path:'supabase/migrations/20261030190000_wrong.sql'}));
  if(mutation==='authority')f.section=f.section.replace('| product-accepted |','| technical-review |');
  assert.throws(()=>verify(f),/SHA-256|Git blob|Accepted authority|exact bytes/);
 }
});
check('preparation-only and nondeployment receipt assertions are mandatory',()=>{
 const required=['Scope: tendev-preparation.','This review is not evidence of hosted application or deployment.','This review grants no migration application, write activation, push or deployment authority.'];
 for(const text of required){const f=fixture();f.section=f.section.replace(text,'');assert.throws(()=>verify(f),/preparation-only scope/);}
 const f=fixture({accepted:false});f.section=f.section.replace('Product acceptance remains pending for these technical changes.','Chris accepts this.');assert.throws(()=>verify(f),/pending Product acceptance/);
});
check('changed or missing candidate membership remains an unresolved hold',()=>{
 for(const absent of [false,true]){const f=fixture();if(absent)f.sources.get(candidate).delete(migration);else f.sources.get(candidate).set(migration,'-- Changed after review.');
  const result=verify(f);assert.equal(result.review,null);assert.equal(result.hold.reason,'candidate-source-proof-changed');
  assert(buildImpactReport([],{candidateRevision:candidate,changedPaths:[migration],sourceReviewHolds:[result.hold]}).reviewRequired);
 }
});
check('current candidate binding, neighboring migration holds and semantic records are never bypassed',()=>{
 const f=fixture(),verified=verify(f).review,neighbor='supabase/migrations/20261030200000_unreviewed.sql';
 assert(buildImpactReport([],{candidateRevision:other,changedPaths:[migration],verifiedCandidateSources:[verified]}).reviewRequired);
 const report=buildImpactReport([],{candidateRevision:candidate,changedPaths:[migration,neighbor],verifiedCandidateSources:[verified]});assert.deepEqual(report.unclassifiedSensitivePaths,[neighbor]);
 const records=[{id:'inventory-claim',dependencyBindings:[{path:migration,kind:'semantic'}]}];
 const bound=buildImpactReport(records,{candidateRevision:candidate,changedPaths:[migration],verifiedCandidateSources:[verified]});assert(bound.reviewRequired);assert.deepEqual(bound.semanticRecordIds,['inventory-claim']);
});
check('strict TenDev full URL and branch protect release preparation without changing read-only review',()=>{
 const source=verify(fixture()).review,valid={releaseBuild:true,cfPagesUrl:'https://tendev.pages.dev',cfPagesBranch:'dev'};
 assert.doesNotThrow(()=>assertCandidatePreparationTarget([source],valid));
 for(const url of [undefined,'https://tenops.pages.dev','https://tendev.pages.dev/','http://tendev.pages.dev','https://tendev.pages.dev:443','https://tendev.pages.dev/other','https://tendev.pages.dev.evil.invalid','https://user@tendev.pages.dev'])assert.throws(()=>assertCandidatePreparationTarget([source],{...valid,cfPagesUrl:url}),/TenDev preparation only/);
 assert.throws(()=>assertCandidatePreparationTarget([source],{...valid,cfPagesBranch:'main'}),/TenDev preparation only/);
 assert.doesNotThrow(()=>assertCandidatePreparationTarget([source],{releaseBuild:false}));assert.doesNotThrow(()=>assertCandidatePreparationTarget([],{...valid,cfPagesUrl:'https://tenops.pages.dev'}));
});
check('exact runtime supersession retains old executed and accepted evidence without laundering authority',()=>{
 const source=verify(fixture({kind:'runtime',accepted:false})).review;
 const historical={path:runtime,classification:'historical-deployed',blob:'1'.repeat(40)},old={path:runtime,kind:'runtime',authority:'product-accepted',blob:'2'.repeat(40)};
 const h={path:runtime,reason:'historical-deployed-source-changed'},c={path:runtime,reason:'candidate-source-proof-changed'},adjacent={path:'other',reason:'unresolved'};
 const result=resolveCandidateSourceEvidence({candidateSources:[source],historical:[],historicalChanges:[{review:historical,hold:h}],candidateChanges:[{review:old,hold:c}],holds:[h,c,adjacent]});
 assert.deepEqual(result.holds,[adjacent]);assert.deepEqual(result.supersededHistorical[0].historicalReview,historical);assert.deepEqual(result.supersededCandidateSources[0].previousCandidateSource,old);
 assert.equal(result.candidateSources[0].authority,'technical-review');assert.equal(result.supersededCandidateSources[0].candidateSource.authority,'technical-review');
});
check('duplicate current proof and applied-migration supersession fail closed',()=>{
 const source=verify(fixture()).review;
 assert.throws(()=>resolveCandidateSourceEvidence({candidateSources:[source,source],historical:[],holds:[]}),/unique/);
 assert.throws(()=>resolveCandidateSourceEvidence({candidateSources:[source],historical:[{path:migration}],holds:[]}),/conflicts/);
 const hold={path:migration,reason:'historical-deployed-source-changed'};
 const result=resolveCandidateSourceEvidence({candidateSources:[source],historical:[],historicalChanges:[{review:{path:migration},hold}],holds:[hold]});assert.deepEqual(result.holds,[hold]);assert.deepEqual(result.supersededHistorical,[]);
});
check('record supersession preserves older proof and clears only the exact source-byte hold',()=>{
 const previous={recordId:'inventory-claim',path:'src/app/inventory/page.tsx',beforeBlob:'1'.repeat(40),afterBlob:'2'.repeat(40),recordDigest:'3'.repeat(64)};
 const current={...previous,afterBlob:'4'.repeat(40)},source={recordId:previous.recordId,path:previous.path,reason:'candidate-source-changed'};
 const content={...source,reason:'record-content-or-authority-changed'},helper={...source,reason:'additional-dependency-changed'};
 const result=resolveRecordReviewSupersessions({recordReviews:[current],recordChanges:[{review:previous,hold:source},{review:previous,hold:content},{review:previous,hold:helper}],holds:[source,content,helper]});
 assert.deepEqual(result.holds,[content,helper]);assert.equal(result.supersededRecords.length,1);assert.deepEqual(result.supersededRecords[0],{previousRecordReview:previous,recordReview:current,previousDependenciesActive:false});
 assert(buildImpactReport([],{sourceReviewHolds:result.holds}).reviewRequired);
});
check('additional dependencies follow only their reviewed AFTER source, while selected-source helper and authority drift always hold',()=>{
 const review={beforeBlob:'1'.repeat(40),afterBlob:'2'.repeat(40),recordDigest:'3'.repeat(64)};
 const state=(candidateBlob,recordDigest=review.recordDigest)=>evaluateRecordReviewCandidate(review,{candidateBlob,recordDigest,additionalDependenciesMatch:false});
 assert.deepEqual(state('4'.repeat(40)),{inapplicable:false,reasons:['candidate-source-changed']});
 assert.deepEqual(state(review.beforeBlob),{inapplicable:true,reasons:[]});
 assert.deepEqual(state(review.afterBlob),{inapplicable:false,reasons:['additional-dependency-changed']});
 assert.deepEqual(state(review.beforeBlob,'5'.repeat(64)),{inapplicable:true,reasons:['record-content-or-authority-changed']});
 assert.deepEqual(state(review.afterBlob,'5'.repeat(64)),{inapplicable:false,reasons:['record-content-or-authority-changed','additional-dependency-changed']});
});
check('different record, path, original binding or claim digest cannot supersede a stale record proof',()=>{
 const previous={recordId:'inventory-claim',path:'src/app/inventory/page.tsx',beforeBlob:'1'.repeat(40),afterBlob:'2'.repeat(40),recordDigest:'3'.repeat(64)};
 const hold={recordId:previous.recordId,path:previous.path,reason:'candidate-source-changed'};
 for(const replacement of [{...previous,recordId:'other'},{...previous,path:'src/other.ts'},{...previous,beforeBlob:'5'.repeat(40)},{...previous,recordDigest:'6'.repeat(64)}]){
  const result=resolveRecordReviewSupersessions({recordReviews:[replacement],recordChanges:[{review:previous,hold}],holds:[hold]});assert.deepEqual(result.holds,[hold]);assert.deepEqual(result.supersededRecords,[]);
 }
});
check('ordinary impact behavior and generated-artifact separation remain unchanged',()=>{
 assert.equal(buildImpactReport([],{changedPaths:['docs/unrelated.md']}).status,'unchanged');
 const artifact='supabase/functions/_shared/tenbot-knowledge-snapshot.ts';
 const report=buildImpactReport([],{changedPaths:[artifact,migration],derivedArtifactPaths:[artifact]});assert(report.reviewRequired);assert.deepEqual(report.unclassifiedSensitivePaths,[migration]);
 assert(buildImpactReport([],{changedPaths:[migration],acknowledgedInfrastructurePaths:[migration],derivedArtifactPaths:[migration]}).reviewRequired);
});
check('actual generator source-archive invocation still refuses candidate builds without full reviewed Git history',()=>{
 const dir=mkdtempSync('/private/tmp/tenbot-candidate-source-proof-');
 for(const path of ['scripts/generate-tenbot-knowledge.mjs','scripts/tenbot-knowledge/manifest.mjs']){mkdirSync(dirname(resolve(dir,path)),{recursive:true});copyFileSync(path,resolve(dir,path));}
 symlinkSync(resolve('node_modules'),resolve(dir,'node_modules'));
 const env={...process.env,CF_PAGES_COMMIT_SHA:candidate,CF_PAGES_URL:'https://tendev.pages.dev',CF_PAGES_BRANCH:'dev'};delete env.TENBOT_KNOWLEDGE_RELEASE_CANDIDATE;
 const result=spawnSync(process.execPath,['scripts/generate-tenbot-knowledge.mjs','--build-sync'],{cwd:dir,env,encoding:'utf8',timeout:15000});assert.equal(result.status,1);assert.match(result.stderr,/full reviewed Git history/);
 const generator=readFileSync('scripts/generate-tenbot-knowledge.mjs','utf8');
 for(const guard of ['full current HEAD SHA','clean tracked and untracked source tree','exact generated knowledge artifact already committed'])assert(generator.includes(guard),guard);
});
const report={passed:true,groups:checks.length,checks,mode:'Offline exact-source proof callbacks plus actual generator source-archive rejection',sharedGitMutations:0,hostedCalls:0,databaseCalls:0,inferenceCalls:0,deploymentAuthority:false};
if(process.env.TENBOT_CANDIDATE_PROOF_EVIDENCE)writeFileSync(process.env.TENBOT_CANDIDATE_PROOF_EVIDENCE,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
