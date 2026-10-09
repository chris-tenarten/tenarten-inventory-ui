// Deliberately allowlisted diagnostics: never serialize errors, payloads or stack traces.
const unavailable='unavailable';
const stages=new Set(['client-validation','save-draft','issue-snapshot','request-validation','source-load','blend-calculation','snapshot-persistence','pdf-render','storage-upload','delivery','authorization','generation']);
const numeric=v=>v===null?null:typeof v==='number'&&Number.isFinite(v)?String(v):typeof v==='string'&&v.length<=40&&/^\s*\d*\.?\d+\s*$/.test(v)?v:unavailable;
const ratio=s=>s?{resin:numeric(s.resinParts),hardener:numeric(s.hardenerParts)}:unavailable;
export function generationDiagnostic(error,stage,context={}){
 const message=String(error?.message??error??'').toLowerCase();
 let code='GENERATION_FAILED',field=unavailable,expected=unavailable,explanation='The operation failed at the reported stage; further backend detail is unavailable.';
 if(/shop preparation quantities|required preparation components/.test(message)){code='SAMPLE_PREPARATION_INCOMPLETE';field='preparation quantities';expected='All required component quantities must be present';explanation='Snapshot issuance rejected incomplete preparation quantities. This is not a ratio validation failure.';}
 else if(/\bratio\b|binder relationship/.test(message)||error?.code==='SAMPLE_INVALID_RATIO'){code='SAMPLE_RATIO_INVALID';field='resinParts / hardenerParts';expected='A supported captured 5:1 or 4:1 relationship';explanation='The ratio validation contract was not satisfied.';}
 else if(/permission|access.*(denied|required)|authentication/.test(message)||error?.code==='42501'){code='GENERATION_ACCESS_DENIED';field='authorization';expected='Existing operation capability and active account';explanation='The existing authorization boundary denied the operation.';}
 else if(/authoritative|batch basis|captured.*basis/.test(message)){code='FORMULATION_AUTHORITY_MISSING';field='captured Batch authority';expected='Authoritative captured formulation required by the operation';explanation='The source formulation lacks required authority.';}
 else if(/invalid.*(identifier|document|request)|unsupported.*action/.test(message)){code='GENERATION_REQUEST_INVALID';field='request';expected='Supported action and valid document/source reference';explanation='Request validation failed.';}
 else if(stage==='pdf-render'){code='PDF_RENDER_FAILED';expected='Captured document can be rendered';explanation='PDF rendering failed; no diagnostic payload or stack is exposed.';}
 else if(stage==='storage-upload'){code='PDF_STORAGE_FAILED';expected='Rendered PDF stored successfully';explanation='PDF Storage upload failed.';}
 else if(stage==='delivery'){code='PDF_DELIVERY_FAILED';expected='Existing captured PDF can be delivered';explanation='PDF delivery failed; retry should use the same captured document.';}
 const state=context.state;const draft=context.draftState??(context.source==='current-draft'?state:null);
 return {code,stage:stages.has(stage)?stage:'generation',field,expected,actual:unavailable,source:context.source==='captured-snapshot'?'captured-snapshot':context.source==='current-draft'?'current-draft':unavailable,correlationId:typeof context.correlationId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(context.correlationId)?context.correlationId:unavailable,explanation,observations:{selectedProfileRatio:ratio(draft?.profile),currentDraftRatio:ratio(draft),savedCapturedRatio:context.source==='captured-snapshot'?ratio(state):unavailable,generationPayloadRatio:unavailable,backendResolvedRatio:unavailable,thicknessIn:numeric(state?.thicknessIn),capturedProductionVolumeCft:context.source==='captured-snapshot'?numeric(state?.derived?.productionVolumeCft):unavailable},payloadContract:'Generation references a saved source/document; no independent ratio is sent.'};
}
export async function diagnosticResponse(user,error,stage,context={}){
 const diagnostic=generationDiagnostic(error,stage,context);
 console.error('[Sample generation]',diagnostic);
 try{const {data,error:lookupError}=await user.rpc('get_my_app_user');const p=Array.isArray(data)?data[0]:data;if(!lookupError&&p?.is_active===true&&['admin','developer'].includes(p?.role))return {diagnostic};}catch{}
 return {};
}
export function readGenerationDiagnostic(value){
 if(!value||typeof value!=='object')return null;
 const messages={SAMPLE_PREPARATION_INCOMPLETE:'shop preparation quantities',SAMPLE_RATIO_INVALID:'invalid ratio',GENERATION_ACCESS_DENIED:'access denied',FORMULATION_AUTHORITY_MISSING:'authoritative basis missing',GENERATION_REQUEST_INVALID:'invalid request',GENERATION_FAILED:'',PDF_RENDER_FAILED:'',PDF_STORAGE_FAILED:'',PDF_DELIVERY_FAILED:''};
 if(!Object.hasOwn(messages,value.code))return null;
 const clean=generationDiagnostic({message:messages[value.code]},value.stage,{source:value.source,correlationId:value.correlationId});
 for(const key of ['selectedProfileRatio','currentDraftRatio','savedCapturedRatio']){const r=value.observations?.[key];clean.observations[key]=r&&typeof r==='object'?{resin:numeric(r.resin),hardener:numeric(r.hardener)}:unavailable;}
 for(const key of ['thicknessIn','capturedProductionVolumeCft'])clean.observations[key]=numeric(value.observations?.[key]);
 return clean;
}
