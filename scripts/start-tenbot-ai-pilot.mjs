// Starts local Wrangler with its remote AI binding; never publishes a Worker.
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {verifyPilot,prepareBindingConfig} from './support/tenbot-ai-pilot.mjs';
const ready=await verifyPilot({confirmFree:process.argv.includes('--free-plan-confirmed')});
console.log(JSON.stringify(ready,null,2));
if(process.argv.includes('--preflight-only'))process.exit(0);
const npxRoot='/Users/chrisngo/.npm/_npx';
const wranglers=readdirSync(npxRoot).map(id=>path.join(npxRoot,id,'node_modules/wrangler')).filter(dir=>existsSync(path.join(dir,'package.json')));
const preferred=wranglers.find(dir=>JSON.parse(readFileSync(path.join(dir,'package.json'),'utf8')).version==='4.151.0');
if(!preferred)throw Error('Existing Wrangler 4.151.0 unavailable; no package installed automatically');
const config=prepareBindingConfig();
const child=spawn(process.execPath,[path.join(preferred,'bin/wrangler.js'),'dev','--config',config,'--ip','127.0.0.1','--port','55594','--persist-to',path.join(path.dirname(config),'wrangler-state')],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exitCode=code??1);
