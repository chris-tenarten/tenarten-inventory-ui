import {
  MODEL,
  INFERENCE_CONTRACT,
  inferenceRequest,
  parseInferenceOutput,
  type InferenceInput,
} from '../../supabase/functions/_shared/tenbot-core';
import {allowedModels,isAllowedModel} from '../../supabase/functions/_shared/tenbot-models';

interface Env {
  AI: { run(model: string, input: ReturnType<typeof inferenceRequest>): Promise<unknown> };
  TENBOT_PILOT_BRIDGE_KEY: string;
}

const MAX_BODY_BYTES = 16_000;
const statuses = new Set(['deployed', 'local', 'planned', 'unknown']);

class InputError extends Error {
  constructor(public status = 400) { super('Invalid pilot request'); }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validInput(value: unknown): value is InferenceInput {
  if (!object(value) || Object.keys(value).some(key => !['question', 'context', 'excerpts', 'draft'].includes(key))) return false;
  if (!text(value.question, 1200) || typeof value.draft !== 'boolean') return false;
  if (!Array.isArray(value.context) || value.context.length > 2 || value.context.some(item => !text(item, 1200))) return false;
  if (!Array.isArray(value.excerpts) || value.excerpts.length > 4 || value.excerpts.reduce((size,item)=>size+(object(item)&&typeof item.guidance==='string'?item.guidance.length:0),0)>8000) return false;
  return value.excerpts.every(item => object(item)
    && Object.keys(item).every(key => ['id', 'title', 'guidance', 'status'].includes(key))
    && text(item.id, 80) && text(item.title, 160) && text(item.guidance, 3000)
    && typeof item.status === 'string' && statuses.has(item.status));
}

async function readInput(request: Request): Promise<InferenceInput> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new InputError(415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new InputError(413);
  if (!request.body) throw new InputError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
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
  catch { throw new InputError(); }
  if (!validInput(body)) throw new InputError();
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
const worker = {
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
      return json({ output, usage: safeUsage(result) });
    } catch {
      return json({ error: 'AI inference unavailable' }, 503);
    }
  },
};

export default worker;
