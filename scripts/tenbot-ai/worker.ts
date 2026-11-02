import {
  MODEL,
  INFERENCE_CONTRACT,
  inferenceRequest,
  parseInferenceOutput,
  type InferenceInput,
} from '../../supabase/functions/_shared/tenbot-core';
import {allowedModels,isAllowedModel} from '../../supabase/functions/_shared/tenbot-models';
import {AGENT_FINAL_SCHEMA,isJsonValue,type StrictSchema} from '../../supabase/functions/_shared/tenbot-agent';

interface Env {
  AI: { run(model: string, input: ReturnType<typeof inferenceRequest>): Promise<unknown> };
  TENBOT_PILOT_BRIDGE_KEY: string;
}

export const PILOT_MAX_BODY_BYTES = 160_000;
const LEGACY_MAX_BODY_BYTES = 16_000;
const MAX_RESULT_BYTES = 16_000;
const statuses = new Set(['deployed', 'local', 'planned', 'unknown']);
const names = new Set(['discover_capabilities','find_jobs','get_job_summary','get_job_planning','get_job_labor_summary','get_production_overview','search_workflow_knowledge','describe_assistant_scope']);
const utf8 = new TextEncoder();

class InputError extends Error {
  constructor(public status = 400) { super('Invalid pilot request'); }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function keys(value:Record<string,unknown>,expected:string[]):boolean {
  return Object.keys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));
}

// Structural transport admission only. Actual tool/schema validation and
// authorization still run in the existing server-owned agent loop.
function schema(value:unknown,depth=0):value is StrictSchema {
  if(!object(value)||!isJsonValue(value)||depth>12)return false;
  const allowed=['type','properties','required','additionalProperties','items','enum','anyOf','minLength','maxLength','minItems','maxItems','minimum','maximum'];
  if(Object.keys(value).some(key=>!allowed.includes(key)))return false;
  if(value.anyOf!==undefined)return keys(value,['anyOf'])&&Array.isArray(value.anyOf)&&value.anyOf.length>0&&value.anyOf.length<=6&&value.anyOf.every(item=>schema(item,depth+1));
  if(!['object','array','string','number','integer','boolean','null'].includes(String(value.type)))return false;
  if(value.enum!==undefined&&(!Array.isArray(value.enum)||value.enum.length===0||value.enum.length>100))return false;
  for(const key of ['minimum','maximum','minLength','maxLength','minItems','maxItems'])if(value[key]!==undefined&&(typeof value[key]!=='number'||!Number.isFinite(value[key])||Math.abs(value[key])>Number.MAX_SAFE_INTEGER))return false;
  for(const key of ['minLength','maxLength','minItems','maxItems'])if(value[key]!==undefined&&(!Number.isSafeInteger(value[key])||Number(value[key])<0||Number(value[key])>PILOT_MAX_BODY_BYTES))return false;
  if(value.type==='object')return value.additionalProperties===false&&object(value.properties)&&Object.keys(value.properties).length<=40&&Array.isArray(value.required)&&new Set(value.required).size===value.required.length&&value.required.length===Object.keys(value.properties).length&&value.required.every(key=>typeof key==='string'&&Object.hasOwn(value.properties as object,key))&&Object.values(value.properties).every(item=>schema(item,depth+1));
  if(value.type==='array')return schema(value.items,depth+1);
  return true;
}

function canonical(value:unknown):string {
  return JSON.stringify(value,(_key,item)=>object(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
}

function validAgent(value:unknown):boolean {
  if(!object(value)||!keys(value,['instructions','history','tools','finalSchema','maxOutputTokens'])||!isJsonValue(value)||!text(value.instructions,16000)||!Number.isSafeInteger(value.maxOutputTokens)||Number(value.maxOutputTokens)<1||Number(value.maxOutputTokens)>640)return false;
  if(!Array.isArray(value.history)||value.history.length<1||value.history.length>32||!value.history.every(item=>{
    if(!object(item))return false;
    if(item.kind==='user')return keys(item,['kind','content'])&&text(item.content,48000);
    if(item.kind==='provider')return keys(item,['kind','items'])&&Array.isArray(item.items)&&item.items.length<=8&&utf8.encode(JSON.stringify(item.items)).byteLength<=24000;
    return item.kind==='tool_result'&&keys(item,['kind','callId','name','output'])&&typeof item.callId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(item.callId)&&typeof item.name==='string'&&names.has(item.name)&&typeof item.output==='string'&&utf8.encode(item.output).byteLength<=24000;
  }))return false;
  if(!Array.isArray(value.tools)||value.tools.length<1||value.tools.length>names.size||new Set(value.tools.map(item=>object(item)?item.name:null)).size!==value.tools.length||!value.tools.every(item=>object(item)&&keys(item,['name','description','parameters'])&&typeof item.name==='string'&&names.has(item.name)&&text(item.description,1200)&&schema(item.parameters)&&item.parameters.type==='object'))return false;
  return schema(value.finalSchema)&&canonical(value.finalSchema)===canonical(AGENT_FINAL_SCHEMA);
}

export function validPilotInput(value: unknown): value is InferenceInput {
  if (!object(value) || !isJsonValue(value) || Object.keys(value).some(key => !['question', 'context', 'excerpts', 'draft', 'operational','agent'].includes(key))) return false;
  if(utf8.encode(JSON.stringify(value)).byteLength>(value.agent===undefined?LEGACY_MAX_BODY_BYTES:PILOT_MAX_BODY_BYTES))return false;
  if (!text(value.question, 1200) || typeof value.draft !== 'boolean') return false;
  if (!Array.isArray(value.context) || value.context.length > 2 || value.context.some(item => !text(item, 1200))) return false;
  if (!Array.isArray(value.excerpts) || value.excerpts.length > 4 || value.excerpts.reduce<number>((size,item)=>size+(object(item)&&typeof item.guidance==='string'?item.guidance.length:0),0)>8000) return false;
  if(value.agent!==undefined)return value.operational===undefined&&!value.draft&&value.context.length===0&&value.excerpts.length===0&&validAgent(value.agent);
  if (value.operational !== undefined) {
    if (value.draft || value.context.length || value.excerpts.length || !object(value.operational)
      || Object.keys(value.operational).some(key => key !== 'facts') || !Array.isArray(value.operational.facts)
      || value.operational.facts.length > 40 || JSON.stringify(value.operational).length > 8000
      || value.operational.facts.some(fact => !object(fact) || Object.keys(fact).some(key => !['id','text'].includes(key))
        || !text(fact.id,80) || !text(fact.text,1200))) return false;
  }
  return value.excerpts.every(item => object(item)
    && Object.keys(item).every(key => ['id', 'title', 'guidance', 'status'].includes(key))
    && text(item.id, 80) && text(item.title, 160) && text(item.guidance, 3000)
    && typeof item.status === 'string' && statuses.has(item.status));
}

async function readInput(request: Request): Promise<InferenceInput> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new InputError(415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > PILOT_MAX_BODY_BYTES)) throw new InputError(413);
  if (!request.body) throw new InputError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > PILOT_MAX_BODY_BYTES) {
        await reader.cancel();
        throw new InputError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new InputError(size>LEGACY_MAX_BODY_BYTES?413:400); }
  if (!object(body))throw new InputError(size>LEGACY_MAX_BODY_BYTES||Number(length)>LEGACY_MAX_BODY_BYTES?413:400);
  if (body.agent===undefined&&(size>LEGACY_MAX_BODY_BYTES||Number(length)>LEGACY_MAX_BODY_BYTES))throw new InputError(413);
  if (!validPilotInput(body)) throw new InputError();
  return body;
}

function authorized(request: Request, secret: string): boolean {
  const supplied = request.headers.get('x-tenbot-pilot-key') ?? '';
  if (typeof secret !== 'string' || secret.length < 32 || supplied.length !== secret.length) return false;
  let mismatch = 0;
  for (let index = 0; index < secret.length; index++) mismatch |= secret.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0;
}

function safeUsage(result: unknown): Record<string, number> | undefined {
  if (!object(result) || !object(result.usage)) return undefined;
  const usage: Record<string, number> = {};
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    const value = result.usage[key];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) usage[key] = value;
  }
  return Object.keys(usage).length ? usage : undefined;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

// Local server-to-server bridge only. No browser CORS, tools, database, or gateway.
export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.has('origin') || !authorized(request, env.TENBOT_PILOT_BRIDGE_KEY)) return json({ error: 'Forbidden' }, 403);
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return json({ ready: true, model: MODEL, models: allowedModels, inferenceContract: INFERENCE_CONTRACT });
    if (path !== '/infer') return json({ error: 'Not found' }, 404);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const model=request.headers.get('x-tenbot-model')??MODEL;
    if(!isAllowedModel(model))return json({error:'Model not allowed'},400);
    let body: InferenceInput;
    try { body = await readInput(request); }
    catch (error) { return json({ error: 'Invalid pilot request' }, error instanceof InputError ? error.status : 400); }
    try {
      const result = await env.AI.run(model, inferenceRequest(body,model));
      let output:unknown;
      try{output=parseInferenceOutput(result);}catch{
        // Return only a format marker; raw provider prose may contain private input.
        output={invalidFormat:true};
      }
      const usage=safeUsage(result);
      if(!isJsonValue(output)||utf8.encode(JSON.stringify({output,usage})).byteLength>MAX_RESULT_BYTES)output={invalidFormat:true};
      return json({ output, usage });
    } catch {
      return json({ error: 'AI inference unavailable' }, 503);
    }
  },
};

export default worker;
