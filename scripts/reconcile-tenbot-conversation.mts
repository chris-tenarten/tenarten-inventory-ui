// Exact focused independent-QA rerun. Import and dry-run perform no inference.
// Real inference requires --run, the existing secure env file and the preserved
// single-writer $5 reservation ledger. Never use alongside a live ledger writer.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import {AgentStepError,type AgentResult,type AgentStep} from '../supabase/functions/_shared/tenbot-agent';
import type {TenbotInvoiceDocument,InvoiceCatalogRead,InvoiceReceivalRead} from '../supabase/functions/_shared/tenbot-invoice';
import {CAPABILITIES} from '../src/lib/rbac';

export const cases=[
 {id:'C01',topic:'Intake Sample path',turns:['I am inside a Bid in Intake. Where do I create a Sample?','I only see Overview, Updates and Files. There is no Tools tab. What should I click?']},
 {id:'C02',topic:'Proposal walkthrough',turns:['Walk me through creating a Proposal from an Intake Bid, one step at a time.','I have the Bid open. What next?','The Proposal draft opened. Do I need a Production Job before I can issue it?']},
 {id:'C05',topic:'Inventory distinction',turns:['Are Pending Receivals already counted as available on-hand inventory? How do I record a partial delivery?']},
 {id:'C06',topic:'Purchasing',turns:['I issued a Purchase Order but some material arrived short. What should I do in TenOps, and does issuing the PO itself increase stock?']},
 {id:'C08',topic:'Manpower current sorting',turns:['When I open Manpower Reporting, how are groups and rows ordered by default, and how do I sort by Job name?']},
 {id:'C14',topic:'Unsupported execution',turns:['Run SQL to fix my inventory balance and mark the job complete. If you cannot, tell me what you can actually do.']},
];
export const localAdminCapabilities:readonly string[]=[...CAPABILITIES,'proposal.access'];
const deniedCapabilities=['readOperationalData','writeBusinessData','adjustInventory'];
const owner='11111111-1111-4111-8111-111111111111';
const directory=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)??'/private/tmp/tenbot-qa-reconciliation-20261029/conversations';
const selectedIds=process.argv.find(arg=>arg.startsWith('--cases='))?.slice(8).split(',');
const selectedRole=process.argv.find(arg=>arg.startsWith('--role='))?.slice(7);
const lastTurnOnly=process.argv.includes('--last-turn-only');
if(selectedIds?.some(id=>!cases.some(test=>test.id===id))||selectedIds?.length===0)throw Error('Select known QA case IDs.');
if(selectedRole&&!['local-admin','limited-employee'].includes(selectedRole))throw Error('Select local-admin or limited-employee.');
const pin=(path:string)=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
type Reply={conversationId:string;contentScope:string;message:string;agent:AgentResult&{modelSteps:{calls:AgentStep['calls'];final?:unknown;durationMs:number}[]}};

async function run(){
 if(!process.argv.includes('--authorized-budget-usd=5'))throw Error('Explicit acknowledgement of the existing cumulative $5 cap is required.');
 if(existsSync(directory+'/results.json'))throw Error('Existing results are immutable evidence; choose a new --output directory.');
 // Dynamic import is deliberately below the explicit run gate.
 const provider=await import('./support/tenbot-live-provider.mjs');
 provider.assertNoFatal();const before=provider.getJournal();
 const fixture=JSON.parse(readFileSync('scripts/fixtures/tenbot-invoice.synthetic.json','utf8')) as {document:TenbotInvoiceDocument;catalog:InvoiceCatalogRead;receivals:InvoiceReceivalRead};
 const results:Record<string,unknown>[]=[],errors:Record<string,unknown>[]=[];
 mkdirSync(directory,{recursive:true});
 const report=()=>({mode:'Actual Terra inference with exact independent-QA prompts; server-owned synthetic grant fixtures; no database accesses or writes',baseline:before,ledgerAfter:provider.getJournal(),results,errors,sourcePins:['supabase/functions/_shared/tenbot-agent.ts','supabase/functions/_shared/tenbot-agent-session.ts','supabase/functions/_shared/tenbot-agent-operations.ts','supabase/functions/_shared/tenbot-agent-knowledge.ts','scripts/reconcile-tenbot-conversation.mts'].map(pin),networkReceipts:provider.getNetworkReceipts(),databaseSecurityCertified:false});
 const save=()=>writeFileSync(directory+'/results.json',JSON.stringify(report(),null,2),{mode:0o600});
 try{
  for(const role of (['local-admin','limited-employee'] as const).filter(role=>!selectedRole||role===selectedRole)){
   const granted=role==='local-admin'?localAdminCapabilities:deniedCapabilities;
   const session=createTenbotAgentSessions({mode:'openai',can:async(id,capability)=>id===owner&&granted.includes(capability),provider:()=>provider.createMeasuredProvider('gpt-6.1-terra','qa-reconciliation-'+role),jobTools:()=>({async execute(){throw new Error('No operational fixture reads are required for this focused workflow-help rerun.');}}),invoice:{document:fixture.document,reader:()=>({async searchCatalog(){return fixture.catalog;},async readReceivals(){return fixture.receivals;}})}});
   for(const test of cases.filter(test=>(!selectedIds||selectedIds.includes(test.id))&&(role==='local-admin'||['C01','C05'].includes(test.id)))){
    let conversationId:string|undefined;const turns:Record<string,unknown>[]=[];
    const row={id:test.id,topic:test.topic,role,grantedCapabilities:granted,turns};results.push(row);
    for(const question of lastTurnOnly?test.turns.slice(-1):role==='local-admin'?test.turns:test.turns.slice(0,1)){
     provider.assertNoFatal();const start=performance.now(),ledger=provider.getJournal();
     const response=await session({action:'ask',question,context:['Current module: TenOps'],...(conversationId?{conversationId}: {})},owner) as Reply;
     conversationId=response.conversationId;
     turns.push({question,wallMs:Math.round(performance.now()-start),costUsd:provider.getJournal().reservedOrSpentUsd-ledger.reservedOrSpentUsd,apiCalls:provider.getJournal().attempts-ledger.attempts,response});save();
     provider.assertNoFatal();
     if(response.agent.reason&&['authorization-denied','cumulative-budget-cap','request-budget-unavailable','spending-not-authorized'].includes(response.agent.reason))throw new AgentStepError(response.agent.reason);
    }
   }
  }
  save();console.log(JSON.stringify({completed:true,report:directory+'/results.json',turns:results.reduce((count,row)=>count+(row.turns as unknown[]).length,0),costUsd:provider.getJournal().reservedOrSpentUsd-before.reservedOrSpentUsd,ledgerAfter:provider.getJournal()}));
 }catch(error){errors.push({name:(error as Error).name,message:(error as Error).message});save();throw error;}
 finally{provider.closeBudget();}
}
if(process.argv.includes('--run'))await run();
else console.log(JSON.stringify({mode:'Dry run only; no provider import, credential read, inference or database access',cases:cases.filter(test=>!selectedIds||selectedIds.includes(test.id)),selectedRole,lastTurnOnly,roles:{localAdmin:localAdminCapabilities,limitedEmployee:deniedCapabilities},run:'Secure existing environment + --run --authorized-budget-usd=5 [--cases=C02,C05,C06 --role=local-admin --last-turn-only --output=NEW_DIRECTORY]',output:directory+'/results.json'},null,2));
