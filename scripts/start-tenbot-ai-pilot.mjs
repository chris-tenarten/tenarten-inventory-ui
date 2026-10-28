// Starts local Wrangler with its remote AI binding; never publishes a Worker.
import {spawn} from 'node:child_process';
import path from 'node:path';
import {verifyPilot,prepareBindingConfig,existingWrangler} from './support/tenbot-ai-pilot.mjs';
const ready=await verifyPilot({confirmFree:process.argv.includes('--free-plan-confirmed')});
console.log(JSON.stringify(ready,null,2));
if(process.argv.includes('--preflight-only'))process.exit(0);
const wrangler=existingWrangler();
const config=prepareBindingConfig();
const child=spawn(process.execPath,[wrangler,'dev','--config',config,'--ip','127.0.0.1','--port','55594','--persist-to',path.join(path.dirname(config),'wrangler-state')],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exitCode=code??1);
