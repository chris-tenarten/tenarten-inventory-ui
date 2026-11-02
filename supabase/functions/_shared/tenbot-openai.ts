/** Optional server-only transport. No SDK, browser credentials, billing activation or built-in tools. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import { AgentStepError, emptyUsage, isJsonValue, type AgentProvider, type AgentStep, type AgentStepRequest, type AgentUsage, type JsonValue } from './tenbot-agent.ts';

export type OpenAIModel = 'gpt-6.1-sol' | 'gpt-6.1-terra';
export type OpenAIPrice = { inputPerMillion: number; cachedInputPerMillion: number; cacheWritePerMillion: number; outputPerMillion: number };
/** Official pricing verified October 28, 2026; operational callers should pin/review prices with their budget. */
export const OPENAI_EXPERIMENT_PRICING: Record<OpenAIModel, OpenAIPrice> = {
  'gpt-6.1-sol': { inputPerMillion: 2, cachedInputPerMillion: 0.10, cacheWritePerMillion: 2.50, outputPerMillion: 10 },
  'gpt-6.1-terra': { inputPerMillion: 1, cachedInputPerMillion: 0.05, cacheWritePerMillion: 1.25, outputPerMillion: 5 },
};
export const OPENAI_PRICING_SOURCE = 'https://developers.openai.com/api/docs/pricing';
export const OPENAI_CACHE_ACCOUNTING_SOURCE = 'https://developers.openai.com/api/docs/guides/prompt-caching';
export type BudgetReservation = { settle(actualUsd?: number): Promise<void> | void };
export type OpenAIResponseMetadata = {
  httpStatus: number | null; errorCode: string; errorType: string; errorParameter: string;
  completionStatus: string; incompleteReason: string;
  usagePresent: boolean; inputTokensPresent: boolean; outputTokensPresent: boolean;
  cachedTokensPresent: boolean; cacheWriteTokensPresent: boolean;
  modelMatches: boolean; serviceTierMatches: boolean;
};
export type OpenAIProviderOptions = {
  model: OpenAIModel; apiKey: string; spendingAuthorized: boolean; pricing: OpenAIPrice;
  /** Atomic server-side reservation must reject when session/month budget is unavailable. Undefined settlement retains the reservation. */
  reserveBudget(usd: number): Promise<BudgetReservation>;
  fetcher?: typeof fetch; timeoutMs?: number;
  /** Hosted accounting pins both the model and Standard service tier. */
  requireResponseMetadata?:boolean;
  /** Optional content-free observer; it cannot change accounting or provider behavior. */
  onResponseMetadata?(metadata: OpenAIResponseMetadata): void | Promise<void>;
  /** Server-downloaded original only. Never a caller-supplied URL or derivative.
   * File/image inputs require an exact pre-count before the shared reservation. */
  originalAttachment?:{filename:string;mediaType:'application/pdf'|'image/png'|'image/jpeg';bytes:Uint8Array};
};
const encoder = new TextEncoder();
const ENDPOINT = 'https://api.openai.com/v1/responses';
const COUNT_ENDPOINT = ENDPOINT+'/input_tokens';
const MAX_REQUEST_BYTES = 180000;
const MAX_RESPONSE_BYTES = 96000;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
const errorCodes = new Set(['invalid_api_key', 'expired_secret_key', 'invalid_request_error', 'invalid_value', 'unsupported_value', 'unknown_parameter', 'unsupported_parameter', 'model_not_found', 'permission_denied', 'insufficient_quota', 'rate_limit_exceeded', 'server_error', 'internal_error', 'invalid_json', 'invalid_parameter', 'organization_usage_limit_exceeded', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'credit_balance_exhausted']);
const errorTypes = new Set(['invalid_request_error', 'authentication_error', 'permission_error', 'rate_limit_error', 'server_error', 'not_found_error', 'insufficient_quota']);
const errorParameters = new Set(['model', 'store', 'service_tier', 'instructions', 'input', 'reasoning', 'reasoning.effort', 'include', 'max_output_tokens', 'prompt_cache_options', 'prompt_cache_options.mode', 'prompt_cache_options.ttl', 'parallel_tool_calls', 'tools', 'text', 'text.format', 'text.format.schema']);
const completionStatuses = new Set(['queued', 'in_progress', 'completed', 'incomplete', 'failed', 'cancelled']);
const incompleteReasons = new Set(['max_output_tokens', 'content_filter']);
const enumValue = (value: unknown, allowed: Set<string>) => value === undefined || value === null || value === 'none' ? 'none' : typeof value === 'string' && allowed.has(value) ? value : 'other';
/** Fresh projection at both producer and hosted sink. Unknown strings, extra
 * fields, raw provider errors, response IDs and content can never cross it. */
export function safeOpenAIResponseMetadata(value: unknown): OpenAIResponseMetadata {
  const item = object(value) ? value : {};
  return {
    httpStatus: typeof item.httpStatus === 'number' && Number.isSafeInteger(item.httpStatus) && item.httpStatus >= 100 && item.httpStatus <= 599 ? item.httpStatus : null,
    errorCode: enumValue(item.errorCode, errorCodes), errorType: enumValue(item.errorType, errorTypes), errorParameter: enumValue(item.errorParameter, errorParameters),
    completionStatus: enumValue(item.completionStatus, completionStatuses), incompleteReason: enumValue(item.incompleteReason, incompleteReasons),
    usagePresent: item.usagePresent === true, inputTokensPresent: item.inputTokensPresent === true, outputTokensPresent: item.outputTokensPresent === true,
    cachedTokensPresent: item.cachedTokensPresent === true, cacheWriteTokensPresent: item.cacheWriteTokensPresent === true,
    modelMatches: item.modelMatches === true, serviceTierMatches: item.serviceTierMatches === true,
  };
}
function responseMetadata(httpStatus: number, payload: unknown, model: OpenAIModel): OpenAIResponseMetadata {
  const value = object(payload) ? payload : {}, error = object(value.error) ? value.error : {}, incomplete = object(value.incomplete_details) ? value.incomplete_details : {};
  const usage = object(value.usage) ? value.usage : {}, details = object(usage.input_tokens_details) ? usage.input_tokens_details : {};
  return safeOpenAIResponseMetadata({ httpStatus, errorCode: error.code, errorType: error.type, errorParameter: error.param, completionStatus: value.status, incompleteReason: incomplete.reason,
    usagePresent: object(value.usage), inputTokensPresent: Object.hasOwn(usage, 'input_tokens'), outputTokensPresent: Object.hasOwn(usage, 'output_tokens'),
    cachedTokensPresent: Object.hasOwn(details, 'cached_tokens'), cacheWriteTokensPresent: Object.hasOwn(details, 'cache_write_tokens'),
    modelMatches: value.model === model, serviceTierMatches: value.service_tier === 'default' });
}
function originalContent(original:NonNullable<OpenAIProviderOptions['originalAttachment']>):JsonValue {
  let binary='';for(let offset=0;offset<original.bytes.length;offset+=8192)binary+=String.fromCharCode(...original.bytes.subarray(offset,offset+8192));
  const data='data:'+original.mediaType+';base64,'+btoa(binary);
  return original.mediaType==='application/pdf'?{type:'input_file',filename:original.filename,file_data:data,detail:'high'}:{type:'input_image',image_url:data,detail:'high'};
}
function validPrice(price: OpenAIPrice) { return object(price) && Object.keys(price).length === 4 && ['inputPerMillion', 'cachedInputPerMillion', 'cacheWritePerMillion', 'outputPerMillion'].every(key => typeof price[key as keyof OpenAIPrice] === 'number' && Number.isFinite(price[key as keyof OpenAIPrice]) && price[key as keyof OpenAIPrice] >= 0) && price.inputPerMillion > 0 && price.outputPerMillion > 0 && price.cachedInputPerMillion <= price.inputPerMillion && price.cacheWritePerMillion >= price.inputPerMillion; }
function nativeInput(request: AgentStepRequest): JsonValue[] {
  const items: JsonValue[] = [];
  for (const item of request.history) {
    if (item.kind === 'user') items.push({ role: 'user', content: item.content });
    else if (item.kind === 'provider') items.push(...item.items);
    else items.push({ type: 'function_call_output', call_id: item.callId, output: item.output });
  }
  return items;
}
export function buildOpenAIRequest(model: OpenAIModel, request: AgentStepRequest): Record<string, JsonValue> {
  if (model !== 'gpt-6.1-sol' && model !== 'gpt-6.1-terra') throw new AgentStepError('model-not-allowed');
  if (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens < 1 || request.maxOutputTokens > 3000) throw new AgentStepError('invalid-output-budget');
  return {
    model, store: false, service_tier:'default', instructions: request.instructions, input: nativeInput(request),
    reasoning: { effort: 'low' }, include: ['reasoning.encrypted_content'], max_output_tokens: request.maxOutputTokens,
    // Pin the documented default write lifetime; no long-lived explicit breakpoints are accepted from employees.
    prompt_cache_options: { mode: 'implicit', ttl: '30m' },
    parallel_tool_calls: false,
    tools: request.tools.map(tool => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters as JsonValue, strict: true })),
    text: { format: { type: 'json_schema', name: 'tenbot_operational_answer', strict: true, schema: request.finalSchema as JsonValue } },
  };
}
function measuredUsage(payload: unknown, price: OpenAIPrice, reserved: number): AgentUsage | null {
  if (!object(payload)) return null;
  const input = payload.input_tokens; const output = payload.output_tokens;
  const details = object(payload.input_tokens_details) ? payload.input_tokens_details : {};
  const cached = details.cached_tokens; const written = details.cache_write_tokens;
  if (typeof input !== 'number' || typeof output !== 'number' || typeof cached !== 'number' || !Number.isSafeInteger(input) || !Number.isSafeInteger(output) || !Number.isSafeInteger(cached) || input < 0 || output < 0 || cached < 0 || cached > input || input > 500000 || output > 100000) return null;
  if (typeof written !== 'number' || !Number.isSafeInteger(written) || written < 0 || cached + written > input) return null;
  // Older documented usage examples expose only the total. Our request pins 30m,
  // so an absent split means that lifetime; a supplied split must reconcile exactly.
  let write30m = written, write12h = 0;
  if (details.cache_write_tokens_details !== undefined) {
    const split = details.cache_write_tokens_details;
    if (!object(split) || typeof split.ttl_30m_tokens !== 'number' || typeof split.ttl_12h_tokens !== 'number' || !Number.isSafeInteger(split.ttl_30m_tokens) || !Number.isSafeInteger(split.ttl_12h_tokens) || split.ttl_30m_tokens < 0 || split.ttl_12h_tokens < 0 || split.ttl_30m_tokens + split.ttl_12h_tokens !== written) return null;
    write30m = split.ttl_30m_tokens; write12h = split.ttl_12h_tokens;
  }
  if (payload.total_tokens !== undefined && payload.total_tokens !== input + output) return null;
  // Write rates replace ordinary input charges; they are not additional surcharges.
  return { inputTokens: input, cachedInputTokens: cached, outputTokens: output, costUsd: ((input - cached - written) * price.inputPerMillion + cached * price.cachedInputPerMillion + write30m * price.cacheWritePerMillion + write12h * price.cacheWritePerMillion * 2 + output * price.outputPerMillion) / 1000000, reservedUsd: reserved };
}
async function boundedBody(response: Response, signal: AbortSignal): Promise<string> {
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) throw new AgentStepError('oversized-response');
  if (!response.body) throw new AgentStepError('empty-response');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      if (signal.aborted) throw new AgentStepError('provider-timeout');
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength; if (size > MAX_RESPONSE_BYTES) throw new AgentStepError('oversized-response'); chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function parseStep(payload: unknown, usage: AgentUsage): AgentStep {
  if (!isJsonValue(payload) || !object(payload) || payload.status !== 'completed' || !Array.isArray(payload.output) || payload.output.length > 30) throw new AgentStepError('incomplete-provider-response', usage);
  const calls: AgentStep['calls'] = []; const texts: string[] = [];
  for (const item of payload.output) {
    if (!object(item) || typeof item.type !== 'string') throw new AgentStepError('invalid-provider-response', usage);
    if (item.type === 'reasoning') continue; // Replay opaque encrypted state verbatim; never expose or interpret reasoning text.
    if (item.type === 'function_call') {
      if (item.status !== undefined && item.status !== 'completed') throw new AgentStepError('incomplete-function-call', usage);
      if (typeof item.call_id !== 'string' || typeof item.name !== 'string' || typeof item.arguments !== 'string' || item.arguments.length > 24000) throw new AgentStepError('invalid-function-call', usage);
      let args: unknown; try { args = JSON.parse(item.arguments); } catch { throw new AgentStepError('invalid-function-arguments', usage); }
      if (!isJsonValue(args) || !object(args)) throw new AgentStepError('invalid-function-arguments', usage);
      calls.push({ id: item.call_id, name: item.name, arguments: args as Record<string, JsonValue> });
    } else if (item.type === 'message') {
      if (item.role !== 'assistant' || (item.status !== undefined && item.status !== 'completed') || !Array.isArray(item.content)) throw new AgentStepError('invalid-provider-message', usage);
      for (const part of item.content) {
        if (!object(part) || part.type !== 'output_text' || typeof part.text !== 'string') throw new AgentStepError('provider-refusal-or-invalid-content', usage);
        texts.push(part.text);
      }
    } else throw new AgentStepError('unapproved-provider-output', usage);
  }
  if (calls.length > 4 || (calls.length > 0 && texts.some(text => text.trim()))) throw new AgentStepError('mixed-provider-output', usage);
  const continuation = payload.output as JsonValue[];
  if (calls.length) return { calls, continuation, usage };
  let final: unknown; try { final = JSON.parse(texts.join('')); } catch { throw new AgentStepError('invalid-structured-output', usage); }
  return { calls: [], final, continuation, usage };
}
export function createOpenAIProvider(options: OpenAIProviderOptions): AgentProvider {
  if (!['gpt-6.1-sol', 'gpt-6.1-terra'].includes(options.model) || !validPrice(options.pricing)) throw new AgentStepError('invalid-provider-configuration');
  if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0 || options.timeoutMs > 30000)) throw new AgentStepError('invalid-provider-timeout');
  // Copy configuration so later mutation cannot silently authorize spending or alter pricing.
  const model = options.model; const price = { ...options.pricing }; const spendingAuthorized = options.spendingAuthorized === true;
  const apiKey = options.apiKey; const fetcher = options.fetcher ?? fetch; const reserve = options.reserveBudget; const timeoutMs = options.timeoutMs ?? 25000; const requireResponseMetadata=options.requireResponseMetadata===true;
  const onResponseMetadata = options.onResponseMetadata;
  const observe = (status: number, payload: unknown) => {
    if (!onResponseMetadata) return;
    try { Promise.resolve(onResponseMetadata(responseMetadata(status, payload, model))).catch(() => {}); } catch { /* Telemetry never affects inference or settlement. */ }
  };
  const original=options.originalAttachment?{...options.originalAttachment,bytes:new Uint8Array(options.originalAttachment.bytes)}:null;
  if(original&&(!original.filename.trim()||original.filename.length>180||/[\u0000-\u001f\u007f]/.test(original.filename)||!['application/pdf','image/png','image/jpeg'].includes(original.mediaType)||!original.bytes.length||original.bytes.length>12000000))throw new AgentStepError('invalid-original-attachment');
  return { name: 'OpenAI Responses', model, async step(request) {
    if (!spendingAuthorized) throw new AgentStepError('spending-not-authorized');
    if (typeof apiKey !== 'string' || apiKey.trim().length < 16 || !reserve) throw new AgentStepError('provider-not-configured');
    if (request.signal.aborted) throw new AgentStepError('provider-cancelled');
    const value=buildOpenAIRequest(model, request),textBytes=encoder.encode(JSON.stringify(value)).byteLength;
    if(textBytes>MAX_REQUEST_BYTES)throw new AgentStepError('oversized-request');
    if(original){const input=value.input as Record<string,JsonValue>[],last=input.filter(item=>item.role==='user').at(-1);if(!last||typeof last.content!=='string')throw new AgentStepError('invalid-original-input');last.content=[{type:'input_text',text:last.content},originalContent(original)];}
    const body = JSON.stringify(value); const inputBytes = encoder.encode(body).byteLength;
    if (inputBytes > (original?16200000:MAX_REQUEST_BYTES)) throw new AgentStepError('oversized-request');
    let documentTokens=0;
    if(original){
      // Same original input as the model request; no Files service or public URL.
      // Counted document tokens are added to the ordinary text/framing bound,
      // deliberately over-reserving text rather than guessing page/image cost.
      let response:Response;try{response=await fetcher(COUNT_ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions:value.instructions,input:value.input,tools:value.tools}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});}catch{throw new AgentStepError('document-token-count-unavailable');}
      const raw=await response.text();if(!response.ok||raw.length>10000)throw new AgentStepError('document-token-count-unavailable');
      let counted:unknown;try{counted=JSON.parse(raw);}catch{throw new AgentStepError('invalid-document-token-count');}
      if(!object(counted)||counted.object!=='response.input_tokens'||!Number.isSafeInteger(counted.input_tokens)||Number(counted.input_tokens)<=0||Number(counted.input_tokens)>50000)throw new AgentStepError('invalid-document-token-count');documentTokens=Number(counted.input_tokens);
    }
    // UTF-8 bytes plus framing conservatively bound text tokens. Assume every
    // input token incurs the pinned 30m cache-write rate; no cache hit is promised.
    const reserved = ((documentTokens+(original?textBytes:inputBytes)+2048) * price.cacheWritePerMillion + request.maxOutputTokens * price.outputPerMillion) / 1000000;
    if (!Number.isFinite(request.remainingUsd) || reserved > request.remainingUsd + 1e-9) throw new AgentStepError('request-budget-unavailable');
    let reservation: BudgetReservation;
    try { reservation = await reserve(reserved); } catch { throw new AgentStepError('request-budget-unavailable'); }
    if (!reservation || typeof reservation.settle !== 'function') throw new AgentStepError('invalid-budget-reservation');
    let usage: AgentUsage = { ...emptyUsage(), costUsd: reserved, reservedUsd: reserved }; let measured = false; let attempted = false;
    const controller = new AbortController(); const abort = () => controller.abort(); request.signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, timeoutMs);
    try {
      request.onReserve(reserved); if (request.signal.aborted) throw new AgentStepError('provider-cancelled'); attempted = true;
      const response = await fetcher(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body, signal: controller.signal });
      const raw = await boundedBody(response, controller.signal); let payload: unknown;
      try { payload = JSON.parse(raw); } catch { observe(response.status, undefined); throw new AgentStepError('invalid-provider-json'); }
      observe(response.status, payload);
      if(response.ok&&requireResponseMetadata&&(!object(payload)||payload.model!==model||payload.service_tier!=='default'))throw new AgentStepError('unexpected-provider-metadata');
      if (object(payload)) { const actual = measuredUsage(payload.usage, price, reserved); if (actual) { usage = actual; measured = true; } }
      // Billing quota requires restored credits/limits; another attempt cannot
      // repair it. Temporary rate limits and server failures retain one retry.
      // https://help.openai.com/en/articles/6614457-troubleshooting-api-usage-and-spend-limits
      const quotaExhausted = response.status === 429 && object(payload) && object(payload.error) && payload.error.type === 'insufficient_quota';
      if (!response.ok) throw new AgentStepError('provider-http-error', usage, (response.status === 429 && !quotaExhausted) || response.status >= 500);
      if (!measured) throw new AgentStepError('missing-provider-usage', usage);
      const step = parseStep(payload, usage); await reservation.settle(usage.costUsd); return step;
    } catch (error) {
      if (!attempted) usage = { ...emptyUsage(), reservedUsd: reserved };
      try { await reservation.settle(!attempted ? 0 : measured ? usage.costUsd : undefined); } catch { /* Keep the external reservation if settlement cannot be confirmed. */ }
      const safe = error instanceof AgentStepError ? error : new AgentStepError(controller.signal.aborted ? 'provider-timeout' : 'provider-transport-error');
      throw new AgentStepError(safe.code, usage, safe.retryable && !controller.signal.aborted);
    } finally { clearTimeout(timeout); request.signal.removeEventListener('abort', abort); controller.abort(); }
  } };
}
