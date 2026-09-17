export async function throwSampleFunctionError(error:unknown):Promise<never>{
  const context=(error as {context?:unknown})?.context;
  let detail='';
  if(context instanceof Response){
    try{
      const body=await context.clone().json() as {error?:unknown};
      detail=body?.error?String(body.error):'';
    }catch{}
  }else if(typeof context==='object'&&context!==null){
    const body=context as {error?:unknown;message?:unknown};
    detail=body.error?String(body.error):body.message?String(body.message):'';
  }
  if(detail)throw Object.assign(new Error(detail),{code:(error as {code?:unknown;status?:unknown})?.code??(error as {status?:unknown})?.status,raw:error});
  if(error instanceof Error)throw error;
  throw Object.assign(new Error('Sample PDF request failed.'),{raw:error});
}
