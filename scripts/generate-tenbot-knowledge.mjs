/** Release-aware, employee-safe knowledge export. No database/network/model access. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
import {modules,release} from './tenbot-knowledge/manifest.mjs';

const target='supabase/functions/_shared/tenbot-knowledge-snapshot.ts';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:10*1024*1024});
const revision=git('rev-parse',`${release.revision}^{commit}`).trim();
if(revision!==release.revision)throw Error('Knowledge export requires the full reviewed runtime revision.');
const receipt=git('show',`${release.receiptRevision}:${release.receipt}`);
if(!receipt.includes('## Executed Intake release')||!receipt.includes(revision))throw Error('Missing executed release receipt for selected runtime.');
const cache=new Map();
function source(path){
 if(!/^(?:src\/|docs\/(?:project\/PROJECT_MANIFEST\.md|project-memory\/CURRENT_STATE\.md|workflows\/|architecture\/production-rework\.md)|supabase\/migrations\/)/.test(path))throw Error(`Source is outside the employee-safe allowlist: ${path}`);
 if(!cache.has(path)){
  const text=git('show',`${revision}:${path}`);
  cache.set(path,{path,revision,blob:git('rev-parse',`${revision}:${path}`).trim(),sha256:createHash('sha256').update(text).digest('hex'),text});
 }
 return cache.get(path);
}
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
 const provenance=files.map(path=>{const {text:unused,...evidence}=source(path);void unused;return evidence;});
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
const output='// Generated by node scripts/generate-tenbot-knowledge.mjs. Do not edit. Server only.\n'+
 'export const knowledgeSnapshot = '+JSON.stringify({schemaVersion:1,revision,verifiedAt:release.verifiedAt,receipt:release.receipt,receiptRevision:git('rev-parse',`${release.receiptRevision}^{commit}`).trim(),generator:'scripts/generate-tenbot-knowledge.mjs',entryCount:entries.length,sourceCount:cache.size},null,2)+' as const;\n'+
 'export const generatedKnowledge = '+JSON.stringify(entries,null,2)+';\n';
if(process.argv.includes('--check')){
 if(readFileSync(target,'utf8')!==output)throw Error('Knowledge snapshot is stale; run node scripts/generate-tenbot-knowledge.mjs.');
 console.log(`TenBot knowledge snapshot verified: ${entries.length} module sources, ${cache.size} pinned files.`);
}else{writeFileSync(target,output);console.log(`Generated ${target}: ${entries.length} module sources, ${cache.size} pinned files.`);}
