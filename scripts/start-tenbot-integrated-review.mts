/** Explicit operator entry point for the existing isolated integration review. */
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
// Root intentionally contains a separate, unaccepted dirty agent experiment.
// Load this ONE module from the accepted backend input without editing/stashing
// it or copying a parallel runtime tree. The rest is the integrated checkout.
const acceptedBackend='afa4bfa47319f5a74101e202a1b675ecf471a1b3';
const agentPath='supabase/functions/_shared/tenbot-agent.ts';
const acceptedAgent=execFileSync('git',['show',acceptedBackend+':'+agentPath],{encoding:'utf8',maxBuffer:1000000});
const agentUrl=pathToFileURL(resolve(agentPath)).href;
const acceptedJavaScript=ts.transpileModule(acceptedAgent,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
// The repository retains Node 20 declarations; this operator script runs on the
// installed Node 24 runtime. Type only the one newer synchronous loader API.
type LoadedModule={format?:string;source?:string|ArrayBuffer|ArrayBufferView;shortCircuit?:boolean};
type ReviewModuleHooks={registerHooks(hooks:{load(url:string,context:unknown,nextLoad:(url:string,context:unknown)=>LoadedModule):LoadedModule}):unknown};
assert(Number(process.versions.node.split('.')[0])>=24,'The isolated review loader requires the existing Node 24 runtime');
(nodeModule as unknown as ReviewModuleHooks).registerHooks({load(url,context,nextLoad){return url===agentUrl?{format:'module',source:acceptedJavaScript,shortCircuit:true}:nextLoad(url,context);}});
process.env.TENBOT_REVIEW_AGENT_BASELINE=acceptedBackend;
const {startIntegratedReview}=await import('./support/tenbot-actions-isolated-review.mjs');
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--enable-isolated-execution'&&!/^--internal-origin=http:\/\/localhost:\d{4,5}$/.test(arg)&&!/^--minutes=\d{1,2}$/.test(arg)))throw Error('Only the fixed isolated fixture, finite execution and localhost internal origin are supported.');
const review=await startIntegratedReview({enableExecution:args.includes('--enable-isolated-execution'),internalOrigin:args.find(arg=>arg.startsWith('--internal-origin='))?.slice('--internal-origin='.length),minutes:Number(args.find(arg=>arg.startsWith('--minutes='))?.slice('--minutes='.length)??30)});
let closing=false;
const shutdown=()=>{if(closing)return;closing=true;void review.close().then(()=>process.exit(0)).catch(()=>{console.error('Review shutdown could not verify isolated control restoration.');process.exit(1);});};
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
console.log('Integrated local API ready at '+review.config.apiUrl+'. Real isolated Auth/history/canonical records; scripted preparation, zero AI inference. Owner-only state: '+review.directory+'.');
