const rpcs=new Set(['consume_web_push_run','claim_web_push_deliveries','prepare_web_push_delivery','finish_web_push_delivery','prune_web_push_transport']);
const stages=new Set([...rpcs,'prepare','recheck']);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:null;
const code=value=>typeof value==='string'&&/^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(value)?value:null;
const status=value=>Number.isInteger(value)&&value>=100&&value<=599?value:null;

// One adapter per worker invocation. No arguments, URLs, headers, error text,
// stacks, or response bodies enter a log record. Logging must never affect retry.
export function createDiagnosticRpc({environment,deploymentId,executionId,connect,transport=fetch,clock=()=>performance.now(),timeout=()=>AbortSignal.timeout(4000),emit=record=>console.error(JSON.stringify(record))}){
 let active;
 const client=connect(async(input,init)=>{
  const current=active;
  const signal=timeout();
  if(current)current.signal=signal;
  try{
   const response=await transport(input,{...init,signal,redirect:'error'});
   if(current)current.http_status=status(response.status);
   return response;
  }catch(error){
   if(current){
    current.abort_reason=signal.aborted?(signal.reason?.name==='TimeoutError'?'timeout':'aborted'):'none';
    current.error_kind=['TimeoutError','AbortError','TypeError'].includes(error?.name)?error.name:'Error';
   }
   throw error;
  }
 });
 return async(name,args={},context={})=>{
  const started=clock();
  const details={http_status:null,abort_reason:'none',error_kind:null};
  active=details;
  let sqlCode=null;
  try{
   const result=await client.rpc(name,name==='prune_web_push_transport'?{p_environment:environment}:args);
   if(result.error){sqlCode=code(result.error.code);throw new Error('Transport database unavailable');}
   return result.data;
  }catch{
   try{
    const stage=context.stage||name;
    if(details.signal?.aborted)details.abort_reason=details.signal.reason?.name==='TimeoutError'?'timeout':'aborted';
    const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value)?value:null;
    emit({event:'web_push_rpc_failed',environment:['tenops','tendev'].includes(environment)?environment:null,
     rpc:rpcs.has(name)?name:null,
     stage:stages.has(stage)?stage:null,run_id:uuid(context.run_id),delivery_id:uuid(context.delivery_id),
     deployment_id:opaque(deploymentId),execution_id:uuid(executionId),
     elapsed_ms:Math.max(0,Math.round(clock()-started)),http_status:details.http_status,
     abort_reason:details.abort_reason,error_kind:details.error_kind,sql_code:sqlCode});
   }catch{/* Diagnostics are best effort; preserve the existing generic RPC failure. */}
   throw new Error('Transport database unavailable');
  }finally{active=undefined;}
 };
}
