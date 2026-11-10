import {readGenerationDiagnostic} from '../../../supabase/functions/_shared/sample-diagnostics.mjs';
export async function throwSampleFunctionError(error:unknown):Promise<never>{
  const context=(error as {context?:unknown})?.context;
  let detail='';let diagnostic=null;
  if(context instanceof Response){
    try{
      const body=await context.clone().json() as {error?:unknown;diagnostic?:unknown};
      detail=body?.error?String(body.error):'';diagnostic=readGenerationDiagnostic(body?.diagnostic);
    }catch{}
  }else if(typeof context==='object'&&context!==null){
    const body=context as {error?:unknown;message?:unknown};
    detail=body.error?String(body.error):body.message?String(body.message):'';
  }
  if(detail)throw Object.assign(new Error(detail),{diagnostic,code:(error as {code?:unknown;status?:unknown})?.code??(error as {status?:unknown})?.status,raw:error});
  if(error instanceof Error)throw error;
  throw Object.assign(new Error('Sample PDF request failed.'),{raw:error});
}
