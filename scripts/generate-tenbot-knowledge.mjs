/** Release-aware, employee-safe knowledge export. No database/network/model access. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,resolve} from 'node:path';
import ts from 'typescript';

const target='supabase/functions/_shared/tenbot-knowledge-snapshot.ts';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:10*1024*1024,stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_NO_LAZY_FETCH:'1',GIT_OPTIONAL_LOCKS:'0'}});
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const fullRevision=value=>{const resolved=git('rev-parse',`${value}^{commit}`).trim();if(resolved!==value)throw Error('Knowledge export requires a full reviewed runtime revision.');return resolved;};
const args=process.argv.slice(2),reviewIndex=args.indexOf('--review-release');
const modes=['--check','--sync','--build-sync','--artifact-check'];
if(args.some((arg,index)=>![...modes,'--review-release'].includes(arg)&&!(reviewIndex>=0&&index===reviewIndex+1))||modes.filter(mode=>args.includes(mode)).length>1||args.filter(arg=>arg==='--review-release').length>1||reviewIndex>=0&&(args.includes('--check')||args.includes('--artifact-check'))||new Set(args).size!==args.length)throw Error('Use --check, --sync, --build-sync, --artifact-check, or --review-release FULL_SHA [--sync].');
if(reviewIndex>=0&&(!args[reviewIndex+1]||args[reviewIndex+1].startsWith('--')))throw Error('--review-release requires a full candidate SHA.');

const capturePaths=[];
const manifestAst=ts.createSourceFile('manifest.mjs',readFileSync('scripts/tenbot-knowledge/manifest.mjs','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
function findCaptures(node){
 if(ts.isPropertyAssignment(node)&&node.name.getText(manifestAst).replace(/^['"]|['"]$/g,'')==='receiptCapture'){
  if(!ts.isStringLiteral(node.initializer)||!/^scripts\/tenbot-knowledge\/release-evidence\/[a-z0-9-]+\.json$/.test(node.initializer.text))throw Error('Invalid receipt capture input; sync knowledge in a full repository after review.');
  capturePaths.push(node.initializer.text);
 }
 ts.forEachChild(node,findCaptures);
}
findCaptures(manifestAst);
const generationInputPaths=[
 'scripts/generate-tenbot-knowledge.mjs','scripts/tenbot-knowledge/manifest.mjs',
 'scripts/tenbot-knowledge/architecture.mjs','scripts/tenbot-knowledge/release-sync.mjs',
 'scripts/tenbot-knowledge/infrastructure-reviews.json',
 'scripts/tenbot-knowledge/source-reviews.json',
 'supabase/functions/_shared/tenbot-knowledge.ts','supabase/functions/_shared/tenbot-workflow-supplement.ts',
 ...capturePaths,
].sort();
const generationInputs=()=>generationInputPaths.map(path=>({path,sha256:digest(readFileSync(path,'utf8'))}));
const artifactDigest=(snapshot,entries,patches)=>{const {artifactDigest:unused,...metadata}=snapshot;void unused;return digest({snapshot:metadata,generatedKnowledge:entries,generatedKnowledgePatches:patches});};
function readArtifact(){
 const ast=ts.createSourceFile(target,readFileSync(target,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),values=new Map();
 const expected=['knowledgeSnapshot','generatedKnowledge','generatedKnowledgePatches'];
 if(ast.parseDiagnostics.length)throw Error('Knowledge artifact has invalid TypeScript.');
 for(const statement of ast.statements){
  if(!ts.isVariableStatement(statement)||!statement.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword)||statement.declarationList.declarations.length!==1)throw Error('Knowledge artifact must contain only generated literal exports.');
  const declaration=statement.declarationList.declarations[0],name=declaration.name.getText(ast);let value=declaration.initializer;
  if(!expected.includes(name)||values.has(name)||!value)throw Error('Unexpected knowledge artifact export.');
  if(ts.isAsExpression(value)){if(value.type.getText(ast)!=='const')throw Error('Unexpected knowledge artifact assertion.');value=value.expression;}
  // The AST selects the exact initializer. JSON parsing rejects executable TS/JS;
  // no generated module, expression or repository code is evaluated here.
  values.set(name,JSON.parse(value.getText(ast)));
 }
 if(values.size!==expected.length)throw Error('Incomplete generated knowledge artifact.');
 return {snapshot:values.get('knowledgeSnapshot'),entries:values.get('generatedKnowledge'),patches:values.get('generatedKnowledgePatches')};
}
function verifyArtifact(){
 try{
  const {snapshot,entries,patches}=readArtifact();
  if(snapshot.artifactFormatVersion!==1||JSON.stringify(snapshot.generationInputs)!==JSON.stringify(generationInputs())||snapshot.artifactDigest!==artifactDigest(snapshot,entries,patches)||snapshot.architectureDigest!==digest(patches)||snapshot.entryCount!==entries.length||snapshot.patchCount!==patches.length)throw Error('Generation inputs or artifact content differ.');
  console.log(`TenBot packaged knowledge verified: ${entries.length} module sources, ${patches.length} patches. Artifact integrity only; no fresh Git, hosted or release-candidate attestation.`);
 }catch(error){throw Error('Packaged TenBot knowledge is stale or modified. Run npm run tenbot:knowledge in a full repository with reviewed history, then include its generated artifact. '+error.message);}
}
// Source archives and shallow exports can verify the committed artifact without
// consulting Git or rewriting application source. Explicit release gates still
// require all reviewed historical objects and cannot use this fallback.
function hasHistory(boundaries){
 if(!existsSync('.git'))return false;
 let gitDir=resolve('.git');
 try{
  const pointer=readFileSync('.git','utf8').match(/^gitdir: (.+)\s*$/m);if(pointer)gitDir=resolve(pointer[1]);
 }catch{/* A normal .git directory has no pointer file. */}
 let commonDir=gitDir;const commonPath=resolve(gitDir,'commondir');
 if(existsSync(commonPath))commonDir=resolve(gitDir,readFileSync(commonPath,'utf8').trim());
 if(existsSync(resolve(gitDir,'shallow'))||existsSync(resolve(commonDir,'shallow')))return false;
 if(!boundaries)return true;
 try{for(const boundary of boundaries){git('cat-file','-e',`${boundary.revision}^{commit}`);if(boundary.receiptRevision)git('cat-file','-e',`${boundary.receiptRevision}^{commit}`);}return true;}catch{return false;}
}
const candidateEnvs=[process.env.TENBOT_KNOWLEDGE_RELEASE_CANDIDATE,process.env.CF_PAGES_COMMIT_SHA].filter(Boolean);
if(new Set(candidateEnvs).size>1)throw Error('Conflicting TenBot release-candidate environment values.');
const buildCandidate=args.includes('--build-sync')?candidateEnvs[0]:undefined;
if(buildCandidate&&!/^[a-f0-9]{40}$/.test(buildCandidate))throw Error('TenBot release builds require a full candidate SHA.');
const selectedReview=reviewIndex>=0?args[reviewIndex+1]:buildCandidate;
if(buildCandidate&&selectedReview!==buildCandidate)throw Error('Explicit and build-environment TenBot release candidates differ.');
const releaseBuild=Boolean(selectedReview&&(args.includes('--sync')||args.includes('--build-sync')));
if(args.includes('--artifact-check')){verifyArtifact();process.exit(0);}
if((args.includes('--build-sync')||releaseBuild)&&!hasHistory()){
 if(buildCandidate||reviewIndex>=0)throw Error('TenBot release preparation requires full reviewed Git history. Run npm run tenbot:knowledge:review-release -- FULL_SHA in the full repository and resolve review holds before release; packaged artifact verification cannot replace this gate.');
 verifyArtifact();process.exit(0);
}
// Artifact-only paths have exited before any maintenance module is evaluated.
const {modules,release,releases,refreshes,infrastructureReviewsPath}=await import('./tenbot-knowledge/manifest.mjs');
if(infrastructureReviewsPath!=='scripts/tenbot-knowledge/infrastructure-reviews.json')throw Error('Infrastructure reviews must use the fixed reviewed evidence path.');
const infrastructureReviews=JSON.parse(readFileSync(infrastructureReviewsPath,'utf8'));
const sourceReviews=JSON.parse(readFileSync('scripts/tenbot-knowledge/source-reviews.json','utf8'));
const {architectureRecords}=await import('./tenbot-knowledge/architecture.mjs');
const {buildImpactReport,isInfrastructurePath,isInfrastructureReviewHeading,isRecordReviewPath}=await import('./tenbot-knowledge/release-sync.mjs');
if((args.includes('--build-sync')||releaseBuild)&&!hasHistory(Object.values(releases))){
 if(buildCandidate||reviewIndex>=0)throw Error('TenBot release preparation requires full reviewed Git history; restore historical objects and run npm run tenbot:knowledge:review-release -- FULL_SHA before release.');
 verifyArtifact();process.exit(0);
}
let committedReleaseArtifact;
if(releaseBuild){
 if(!/^[a-f0-9]{40}$/.test(selectedReview)||fullRevision(selectedReview)!==git('rev-parse','HEAD').trim())throw Error('TenBot release build must nominate the full current HEAD SHA; read-only --review-release may inspect another candidate.');
 if(git('status','--porcelain=v1','--untracked-files=all').trim())throw Error('TenBot release build requires a clean tracked and untracked source tree. Commit reviewed source and exact generated knowledge, then rerun the candidate gate; release builds never regenerate source.');
 committedReleaseArtifact=git('show',`${selectedReview}:${target}`);
}
const releaseProofs=new Map();
function releaseProof(id){
 if(releaseProofs.has(id))return releaseProofs.get(id);
 const selected=releases[id];if(!selected)throw Error(`Unknown reviewed release: ${id}`);
 const revision=fullRevision(selected.revision);let receipt,proof;
 if(selected.receiptCapture){
  if(!/^scripts\/tenbot-knowledge\/release-evidence\/[a-z0-9-]+\.json$/.test(selected.receiptCapture))throw Error('Invalid receipt capture path.');
  const bytes=readFileSync(selected.receiptCapture,'utf8');
  if(digest(bytes)!==selected.receiptCaptureSha256)throw Error(`Reviewed receipt capture changed: ${id}`);
  const captured=JSON.parse(bytes);
  if(captured.schemaVersion!==1||captured.kind!=='captured-working-receipt'||captured.originPath!==selected.receipt||captured.heading!==selected.receiptHeading||typeof captured.originWorkingSha256!=='string'||!/^[a-f0-9]{64}$/.test(captured.originWorkingSha256)||digest(captured.excerpt)!==captured.excerptSha256)throw Error(`Invalid reviewed receipt capture: ${id}`);
  receipt=captured.excerpt;
  proof={receiptKind:'captured-working-receipt',receiptCapture:selected.receiptCapture,receiptCaptureSha256:selected.receiptCaptureSha256,originWorkingSha256:captured.originWorkingSha256};
 }else{
  const receiptRevision=git('rev-parse',`${selected.receiptRevision}^{commit}`).trim();
  receipt=git('show',`${receiptRevision}:${selected.receipt}`);proof={receiptKind:'committed',receiptRevision};
 }
 const start=receipt.indexOf(selected.receiptHeading);
 const section=start<0?'':receipt.slice(start).split(/\n## /)[0];
 if(!selected.receiptHeading?.startsWith('## Executed ')||!section.includes(revision))throw Error(`Missing scoped executed release receipt: ${id}`);
 const result={id,revision,verifiedAt:selected.verifiedAt,receipt:selected.receipt,receiptAnchor:selected.receiptAnchor,receiptSha256:digest(section),...proof};
 releaseProofs.set(id,result);return result;
}
const baseRelease=releaseProof('intake'),revision=baseRelease.revision;
const cache=new Map();
function source(path,sourceRevision=revision){
 if(!/^(?:src\/|docs\/(?:project\/PROJECT_MANIFEST\.md|project-memory\/[a-zA-Z0-9_-]+\.md$|workflows\/|schemas\/|architecture\/)|supabase\/(?:migrations\/|functions\/[a-z0-9_-]+\/))/.test(path)||path.includes('..')||!/[.](?:ts|tsx|mts|mjs|sql|md)$/.test(path))throw Error(`Source is outside the reviewed source allowlist: ${path}`);
 const key=sourceRevision+':'+path;
 if(!cache.has(key)){
  const text=git('show',`${sourceRevision}:${path}`);
  cache.set(key,{path,revision:sourceRevision,blob:git('rev-parse',`${sourceRevision}:${path}`).trim(),sha256:digest(text),text});
 }
 return cache.get(key);
}
const pin=(path,sourceRevision=revision)=>{const {text:unused,...evidence}=source(path,sourceRevision);void unused;return evidence;};
function publicText(text){
 const publicSentences=text.split(/(?<=[.!?])\s+(?=[A-Z`])/).filter(sentence=>!/(?:\b[a-z]+_[a-z_]+\b|<job id>|original:|rework:|\bjobs\.id\b|\bSupabase\b|\bdatabase\b|^Chris's|^See the scoped contract)/.test(sentence)).join(' ');
 return publicSentences.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\*\*/g,'').replace(/\s+/g,' ').trim();
}
const forbidden=/\b(?:NEXT_PUBLIC_|SUPABASE_|CLOUDFLARE_|Bearer\s|eyJ[A-Za-z0-9_-]+\.|service_role|password|sha256|[a-f0-9]{40,64})\b|https?:\/\/|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
function documentation(item){
 const blocks=source(item.path).text.split(/\n\s*\n/).flatMap(block=>item.paragraphs.some(prefix=>prefix.startsWith('- '))&&block.startsWith('- ')?block.split('\n'):block);
 return item.paragraphs.flatMap(prefix=>{
  const index=blocks.findIndex(block=>block.trim().startsWith(prefix));
  if(index<0)throw Error(`Missing reviewed paragraph ${item.path}: ${prefix}`);
  const found=[blocks[index]];
  if(/:\s*$/.test(blocks[index])&&/^\s*- /.test(blocks[index+1]||''))found.push(blocks[index+1]);
  return found.map(publicText).filter(block=>!forbidden.test(block));
 });
}
function controls(path,range){
 const input=source(path).text;
 const ast=ts.createSourceFile(path,input,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const collected=[];
 const from=range?input.indexOf(range.from):0,to=range?input.indexOf(range.to,from):input.length;
 if(from<0||to<0)throw Error(`Missing reviewed UI range in ${path}`);
 function visit(node){
  if(node.end<from||node.pos>to)return;
  if(ts.isJsxText(node)&&!node.parent.children?.some(child=>ts.isJsxExpression(child)&&child.expression))collected.push(node.text);
  if(ts.isJsxAttribute(node)&&/^(?:aria-label|placeholder|title)$/.test(node.name.getText(ast))&&node.initializer&&ts.isStringLiteral(node.initializer))collected.push(node.initializer.text);
  if(ts.isPropertyAssignment(node)&&/^(?:label|description)$/.test(node.name.getText(ast))&&ts.isStringLiteral(node.initializer))collected.push(node.initializer.text);
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='tr'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))collected.push(node.arguments[0].text);
  ts.forEachChild(node,visit);
 }
 visit(ast);
 return [...new Set(collected.map(publicText).filter(text=>text.length>2&&text.length<350&&/[a-z]{2}/i.test(text)&&!forbidden.test(text)&&!/[{}<>]|(?:className|\.tsx|\bpublic\.)/.test(text)))];
}
const entries=modules.flatMap(module=>{
 const {docs=[],ui=[],ranges=[],contracts=[],excludeUI='',boundary,...binding}=module;
 if(binding.route){const routeFile=`src/app${binding.route==='/'?'':binding.route}/page.tsx`;source(routeFile);}
 const facts=docs.flatMap(documentation);
 const uiText=[...new Set([...ui.flatMap(path=>controls(path)),...ranges.flatMap(range=>controls(range.path,range))])].filter(text=>!excludeUI||!new RegExp(excludeUI,'i').test(text));
 // Bound chunks on paragraph boundaries; a release can grow without a new entry per question.
 const groups=[[]];
 for(const fact of facts){
  if(fact.length+boundary.length>2600)throw Error(`Single reviewed paragraph is too long: ${module.id}`);
  const current=groups[groups.length-1];
  if(boundary.length+current.join(' ').length+fact.length>2500)groups.push([fact]);else current.push(fact);
 }
 const files=[...new Set([...docs.map(item=>item.path),...ui,...ranges.map(item=>item.path),...contracts,'src/lib/rbac.ts','src/components/BusinessWriteControls.tsx',...(binding.route?[`src/app${binding.route==='/'?'':binding.route}/page.tsx`]:[])])];
 const provenance=files.map(path=>pin(path));
 return groups.map((paragraphs,index)=>{
  const text=[boundary,...paragraphs].join(' ');
  const labels=index===0?uiText.filter(text=>!text.endsWith('…')).join(' · '):'';
  const labelPrefix=' Static source interface text (labels do not establish a click sequence or additional permissions): ';
  const available=Math.max(0,2950-text.length-labelPrefix.length);
  const boundedLabels=labels.length<=available?labels:labels.slice(0,available).replace(/ · [^·]*$/,'');
  const guidance=text+(boundedLabels?labelPrefix+boundedLabels:'');
  if(guidance.length>3000||forbidden.test(guidance))throw Error(`Unsafe/oversize employee source ${module.id}`);
  return {...binding,id:`knowledge-${module.id}${index?`-${index+1}`:''}`,status:'deployed',requiredTerms:[module.terms.split(' ')],guidance,source:'TenOps verified application knowledge',evidence:`${release.receipt}#${release.receiptAnchor}`,sourceFiles:files,examples:[],provenance};
 });
});

// Read literal maintenance metadata only, without executing the runtime registry.
// This also covers precise and supplemental guides in release impact reports.
function authoredEntries(path){
 const ast=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),result=[];
 const literal=node=>{
  if(ts.isStringLiteral(node)||ts.isNumericLiteral(node))return ts.isStringLiteral(node)?node.text:Number(node.text);
  if(node.kind===ts.SyntaxKind.TrueKeyword)return true;if(node.kind===ts.SyntaxKind.FalseKeyword)return false;if(node.kind===ts.SyntaxKind.NullKeyword)return null;
  if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);
  if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(property=>{
   if(!ts.isPropertyAssignment(property)||!(ts.isIdentifier(property.name)||ts.isStringLiteral(property.name)))throw Error('Authored knowledge metadata must remain literal.');
   return [property.name.text,literal(property.initializer)];
  }));
  throw Error('Authored knowledge metadata must remain literal.');
 };
 function visit(node){
  if(ts.isObjectLiteralExpression(node)){
   const properties=new Map(node.properties.filter(ts.isPropertyAssignment).map(item=>[item.name.getText(ast).replace(/^['"]|['"]$/g,''),item.initializer]));
   const id=properties.get('id'),files=properties.get('sourceFiles');
   if(id&&ts.isStringLiteral(id)&&files&&ts.isArrayLiteralExpression(files)&&files.elements.every(ts.isStringLiteral)){
    result.push(literal(node));
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);return result;
}
const authored=[...authoredEntries('supabase/functions/_shared/tenbot-knowledge.ts'),...authoredEntries('supabase/functions/_shared/tenbot-workflow-supplement.ts')];
const allEntries=new Map([...authored,...entries].map(entry=>[entry.id,entry]));
if(allEntries.size!==authored.length+entries.length)throw Error('Duplicate published knowledge ID.');
const pending=new Map();
for(const refresh of refreshes)for(const id of refresh.ids){
 const existing=allEntries.get(id);if(!existing)throw Error(`Unknown refreshed knowledge ID: ${id}`);
 pending.set(id,{id,release:refresh.release,sourceFiles:refresh.sourceFiles,terms:existing.terms+' '+refresh.appendTerms,path:refresh.path,guidance:refresh.guidance,source:refresh.source});
}
const architectureKeys=['entities','relationships','facts','preconditions','effects','approvalRequirements','limitations'];
function validateArchitecture(value,id){
 const fail=()=>{throw Error(`Invalid or unsafe architecture facets: ${id}`);};
 const object=(item,required,optional=[])=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||required.some(key=>!Object.hasOwn(item,key))||Object.keys(item).some(key=>![...required,...optional].includes(key)))fail();
 };
 const text=(item,max=500)=>{if(typeof item!=='string'||!item.trim()||item.length>max||forbidden.test(item)||/\b(?:public|auth|storage)\.[a-z_]+|(?:src|supabase|scripts)\//.test(item))fail();};
 object(value,architectureKeys);
 if(architectureKeys.some(key=>!Array.isArray(value[key])||value[key].length>8))fail();
 value.entities.forEach(item=>text(item,80));
 for(const relation of value.relationships){object(relation,['from','relation','to'],['cardinality']);text(relation.from,80);text(relation.relation,120);text(relation.to,80);if(relation.cardinality!==undefined)text(relation.cardinality,80);}
 for(const fact of value.facts){object(fact,['text','classification','verification']);text(fact.text);if(!['schema-contract','product-convention','operational-rule'].includes(fact.classification)||!['repository-contract','released-source'].includes(fact.verification))fail();}
 for(const key of ['preconditions','effects','approvalRequirements','limitations'])value[key].forEach(item=>text(item));
 if(Buffer.byteLength(JSON.stringify(value),'utf8')>3000)fail();
}
for(const record of architectureRecords){
 if(!allEntries.has(record.id))throw Error(`Unknown architecture knowledge ID: ${record.id}`);
 validateArchitecture(record.architecture,record.id);
 if(record.relatedRecordIds.some(id=>!allEntries.has(id)))throw Error(`Unknown related knowledge ID: ${record.id}`);
 const prior=pending.get(record.id);
 if(prior&&prior.release!==record.release)throw Error(`Conflicting refresh/architecture release: ${record.id}`);
 pending.set(record.id,{...prior,...record,sourceFiles:[...new Set([...(prior?.sourceFiles??[]),...record.sourceFiles])]});
}
const patches=[...pending.values()].map(record=>{
 const boundary=releaseProof(record.release),base=allEntries.get(record.id);
 const sourceFiles=[...new Set([...base.sourceFiles,...record.sourceFiles,'supabase/functions/_shared/rbac.ts'])].sort();
 const provenance=sourceFiles.map(path=>pin(path,boundary.revision));
 const {release:unused,...fields}=record;void unused;
 if(fields.guidance&&(fields.guidance.length>3000||forbidden.test(fields.guidance)))throw Error(`Unsafe refreshed guidance: ${fields.id}`);
 const patch={...fields,sourceFiles,provenance,releaseBoundary:boundary,evidence:boundary.receipt+'#'+boundary.receiptAnchor,
  capabilityAvailability:{application:base.availability==='partial'?'partial':base.status==='deployed'?'released':'unverified',assistant:record.toolNames?.length?'read-if-registered':'guidance-only'},
  dependencyBindings:provenance.map(binding=>({...binding,kind:'semantic'}))};
 return {...patch,recordDigest:digest(patch)};
}).sort((a,b)=>a.id.localeCompare(b.id));

const patchById=new Map(patches.map(patch=>[patch.id,patch]));
const impactRecords=[...allEntries.values()].map(record=>{
 const patch=patchById.get(record.id);if(patch)return {...patch,reviewDigest:digest({...record,...patch})};
 const moduleSpec=modules.find(module=>record.id===`knowledge-${module.id}`||record.id.startsWith(`knowledge-${module.id}-`));
 const interfaces=new Set([...(moduleSpec?.ui??[]),...(moduleSpec?.ranges??[]).map(range=>range.path)]);
 const contracts=new Set(moduleSpec?.contracts??[]);
 const dependencyBindings=record.sourceFiles.map(path=>({...pin(path),kind:interfaces.has(path)&&!contracts.has(path)?'interface':'semantic'}));
 return {id:record.id,relatedRecordIds:[],dependencyBindings,reviewDigest:digest({...record,dependencyBindings})};
});
function verifiedInfrastructureReviews(candidateRevision){
 if(!Array.isArray(infrastructureReviews))throw Error('Infrastructure reviews must be an explicit reviewed manifest list.');
 const semanticPaths=new Set(impactRecords.flatMap(record=>record.dependencyBindings.filter(binding=>binding.kind==='semantic').map(binding=>binding.path))),verified=[];
 for(const review of infrastructureReviews){
  if(!review||Object.keys(review).sort().join(',')!=='blob,classification,path,receipt'||review.classification!=='infrastructure-only'||!isInfrastructurePath(review.path)||semanticPaths.has(review.path)||!/^[a-f0-9]{40}$/.test(review.blob))throw Error('Infrastructure acknowledgment cannot cover migrations, permissions or bound semantic records.');
  const proof=review.receipt;
  if(!proof||Object.keys(proof).sort().join(',')!=='heading,path,revision'||!/^docs\/[a-zA-Z0-9_/-]+\.md$/.test(proof.path)||proof.path.includes('..')||!isInfrastructureReviewHeading(proof.heading))throw Error('Infrastructure acknowledgment requires a scoped committed accepted infrastructure review.');
  const receiptRevision=fullRevision(proof.revision),text=git('show',`${receiptRevision}:${proof.path}`),start=text.indexOf(proof.heading),section=start<0?'':text.slice(start).split(/\n## /)[0];
  if(!/(?:^|\n)\s*(?:\*\*)?Chris (?:explicitly )?(?:accepts|approves)\b/i.test(section)||!/(?:^|\n)\s*(?:\*\*)?Business meaning, permission policy, lifecycle,? and effects are unchanged\b/i.test(section)||!section.includes(review.path)||!section.includes(review.blob))throw Error('Infrastructure review must record Chris acceptance, exact path/blob and unchanged business meaning, permission policy, lifecycle and effects.');
  let candidateBlob=null;try{candidateBlob=git('rev-parse',`${candidateRevision}:${review.path}`).trim();}catch{/* An absent or newer path is not acknowledged. */}
  if(candidateBlob===review.blob)verified.push({...review,receipt:{...proof,revision:receiptRevision}});
 }
 return verified;
}
function committedReviewSection(proof){
 if(!proof||Object.keys(proof).sort().join(',')!=='heading,path,revision'||!/^docs\/[a-zA-Z0-9_/-]+\.md$/.test(proof.path)||proof.path.includes('..')||typeof proof.heading!=='string'||!proof.heading.startsWith('## '))throw Error('Source review requires a scoped committed receipt.');
 const revision=fullRevision(proof.revision),text=git('show',`${revision}:${proof.path}`),start=text.indexOf(proof.heading);
 if(start<0)throw Error('Missing committed source-review section.');
 return text.slice(start).split(/\n## /)[0];
}
const pathBlob=(revision,path)=>{try{return git('rev-parse',`${revision}:${path}`).trim();}catch{return null;}};
function verifiedSourceReviews(candidateRevision){
 if(!Array.isArray(sourceReviews))throw Error('Source reviews must be an explicit reviewed evidence list.');
 const records=new Map(impactRecords.map(record=>[record.id,record])),recordReviews=[],historical=[],holds=[];
 for(const review of sourceReviews){
  if(review?.classification==='record-no-claim-impact'){
   const required=['classification','recordId','path','beforeBlob','afterBlob','recordDigest','reviewedCandidate','receipt'];
   if(required.some(key=>!Object.hasOwn(review,key))||Object.keys(review).some(key=>![...required,'additionalDependencies'].includes(key))||!isRecordReviewPath(review.path)||! /^[a-f0-9]{40}$/.test(review.beforeBlob)||! /^[a-f0-9]{40}$/.test(review.afterBlob)||! /^[a-f0-9]{64}$/.test(review.recordDigest))throw Error('Invalid record-specific source review.');
   const record=records.get(review.recordId),binding=record?.dependencyBindings.find(binding=>binding.path===review.path&&binding.kind==='semantic');
   if(!binding||binding.blob!==review.beforeBlob)throw Error('Record review does not match the original semantic source baseline.');
   const section=committedReviewSection(review.receipt),words=review.receipt.heading.toLowerCase().split(/[^a-z]+/);
   if(!['accepted','record','source','review'].every(word=>words.includes(word))||!/(?:^|\n)\s*(?:\*\*)?Chris (?:explicitly )?(?:accepts|approves)\b/i.test(section)||!/(?:^|\n)\s*(?:\*\*)?Business meaning, permission policy, lifecycle,? and effects are unchanged\b/i.test(section)||![review.recordId,review.path,review.beforeBlob,review.afterBlob,review.recordDigest].every(value=>section.includes(value)))throw Error('Record source review requires explicit acceptance and exact record, content/authority and source-byte evidence.');
   // The receipt commits the reviewed source tree. Its own SHA cannot appear in
   // its text; bind both references to that same commit instead of a self-hash.
   const reviewedCandidate=fullRevision(review.reviewedCandidate);
   if(reviewedCandidate!==fullRevision(review.receipt.revision))throw Error('Record source review and accepted source bytes must belong to the same committed tree.');
   if(pathBlob(reviewedCandidate,review.path)!==review.afterBlob)throw Error('Reviewed candidate does not contain the accepted source bytes.');
   const dependencies=review.additionalDependencies??[];
   if(!Array.isArray(dependencies)||dependencies.length>20||dependencies.some(dependency=>!dependency||Object.keys(dependency).sort().join(',')!=='blob,path'||typeof dependency.path!=='string'||dependency.path.includes('..')||!isRecordReviewPath(dependency.path)||! /^[a-f0-9]{40}$/.test(dependency.blob)))throw Error('Invalid additional record-review dependencies.');
   for(const dependency of dependencies)if(pathBlob(reviewedCandidate,dependency.path)!==dependency.blob||![dependency.path,dependency.blob].every(value=>section.includes(value)))throw Error('Additional source dependencies must be accepted at their exact reviewed bytes.');
   const mismatch=record.reviewDigest!==review.recordDigest?'record-content-or-authority-changed':pathBlob(candidateRevision,review.path)!==review.afterBlob?'candidate-source-changed':dependencies.some(dependency=>pathBlob(candidateRevision,dependency.path)!==dependency.blob)?'additional-dependency-changed':null;
   if(mismatch)holds.push({recordId:review.recordId,path:review.path,reason:mismatch});else recordReviews.push(review);
  }else if(review?.classification==='historical-deployed'){
   if(Object.keys(review).sort().join(',')!=='blob,classification,path,release'||typeof review.path!=='string'||review.path.includes('..')||! /^(?:src\/|supabase\/)/.test(review.path)||! /^[a-f0-9]{40}$/.test(review.blob)||!review.release||Object.keys(review.release).sort().join(',')!=='receipt,revision')throw Error('Invalid historical deployed-source review.');
   const deployedRevision=fullRevision(review.release.revision),section=committedReviewSection(review.release.receipt);
   if(!review.release.receipt.heading.startsWith('## Executed ')||!section.includes(deployedRevision)||!/TenDev/.test(section)||!/TenOps/.test(section)||!/deploy(?:ed|ment)|released to/i.test(section)||/^supabase\/migrations\//.test(review.path)&&!section.includes(basename(review.path))||pathBlob(deployedRevision,review.path)!==review.blob)throw Error('Historical source requires original executed deployment evidence and exact released bytes; migration application cannot be inferred from repository presence.');
   if(pathBlob(candidateRevision,review.path)===review.blob)historical.push(review);else holds.push({path:review.path,reason:'historical-deployed-source-changed'});
  }else throw Error('Unknown source-review classification.');
 }
 return {recordReviews,historical,holds};
}
const architectureDigest=digest(patches),sourceCount=new Set(entries.flatMap(entry=>entry.provenance.map(binding=>binding.path))).size;
const snapshot={schemaVersion:1,revision,verifiedAt:release.verifiedAt,receipt:release.receipt,receiptRevision:baseRelease.receiptRevision,generator:'scripts/generate-tenbot-knowledge.mjs',entryCount:entries.length,sourceCount,
 architectureVersion:1,architectureDigest,patchCount:patches.length,releaseBoundaries:[...releaseProofs.values()],artifactFormatVersion:1,generationInputs:generationInputs()};
snapshot.artifactDigest=artifactDigest(snapshot,entries,patches);
const output='// Generated by node scripts/generate-tenbot-knowledge.mjs. Do not edit. Server only.\n'+
 'export const knowledgeSnapshot = '+JSON.stringify(snapshot,null,2)+' as const;\n'+
 'export const generatedKnowledge = '+JSON.stringify(entries,null,2)+';\n'+
 'export const generatedKnowledgePatches = '+JSON.stringify(patches,null,2)+';\n';

const writeArtifact=()=>{if(!existsSync(target)||readFileSync(target,'utf8')!==output){writeFileSync(target,output);return true;}return false;};
if(releaseBuild&&(committedReleaseArtifact!==output||readFileSync(target,'utf8')!==output))throw Error('TenBot release build requires the exact generated knowledge artifact already committed. Run npm run tenbot:knowledge in the full repository, review and commit it, then rerun the candidate gate.');
if(selectedReview){
 const candidateRevision=fullRevision(selectedReview),changedBindings=[];
 for(const record of impactRecords)for(const binding of record.dependencyBindings){
  let after=null;try{after=git('rev-parse',`${candidateRevision}:${binding.path}`).trim();}catch{/* A removed dependency is a change. */}
  if(after!==binding.blob)changedBindings.push({recordId:record.id,path:binding.path,kind:binding.kind,before:binding.blob,after});
 }
 const changedPaths=[...new Set([...releaseProofs.values()].flatMap(boundary=>git('diff','--name-only',boundary.revision,candidateRevision).trim().split('\n').filter(Boolean)))];
 const infrastructureReviewEvidence=verifiedInfrastructureReviews(candidateRevision);
 const sourceReviewEvidence=verifiedSourceReviews(candidateRevision);
 // Generated output cannot acknowledge its own blob through an input list: that
 // would be self-referential. Exact recomputation proves only this derived file;
 // every independent source, semantic-record and migration hold still applies.
 const candidateArtifact=pathBlob(candidateRevision,target),expectedArtifact=createHash('sha1').update(`blob ${Buffer.byteLength(output,'utf8')}\0`).update(output).digest('hex');
 const derivedArtifactPaths=candidateArtifact===expectedArtifact?[target]:[];
 const report={...buildImpactReport(impactRecords,{candidateRevision,changedPaths,changedBindings,acknowledgedInfrastructurePaths:infrastructureReviewEvidence.map(review=>review.path),verifiedRecordReviews:sourceReviewEvidence.recordReviews,historicalDeployedPaths:sourceReviewEvidence.historical.map(review=>review.path),derivedArtifactPaths,sourceReviewHolds:sourceReviewEvidence.holds}),infrastructureReviewEvidence,sourceReviewEvidence,
  recordReviewDigests:impactRecords.map(record=>({recordId:record.id,recordDigest:record.reviewDigest}))};
 console.log(JSON.stringify(report,null,2));
 if(report.reviewRequired){process.exitCode=1;}else if(releaseBuild){console.log('Committed knowledge and nominated candidate tree match exactly; no source rewrite or deployed-pin advance.');}
}else if(args.includes('--check')){
 if(readFileSync(target,'utf8')!==output)throw Error('Knowledge snapshot is stale; run node scripts/generate-tenbot-knowledge.mjs --sync after source/release review.');
 console.log(`TenBot knowledge snapshot verified: ${entries.length} module sources, ${sourceCount} pinned files, ${patches.length} structured/refresh patches.`);
}else{const changed=writeArtifact();console.log(`${changed?'Generated':'Retained unchanged'} ${target}: ${entries.length} module sources, ${sourceCount} pinned files, ${patches.length} structured/refresh patches.`);}
