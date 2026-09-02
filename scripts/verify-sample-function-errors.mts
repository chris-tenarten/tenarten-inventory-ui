import assert from'node:assert/strict';
import {throwSampleFunctionError} from'../src/modules/samples/function-errors';

await assert.rejects(()=>throwSampleFunctionError({context:{error:'Hosted Sample function is unavailable.'}}),/Hosted Sample function is unavailable/);
await assert.rejects(()=>throwSampleFunctionError({context:new Response(JSON.stringify({error:'Rendered function detail'}),{status:500,headers:{'content-type':'application/json'}})}),/Rendered function detail/);
const original=new Error('Original transport failure');
await assert.rejects(()=>throwSampleFunctionError(original),(caught)=>caught===original);
await assert.rejects(()=>throwSampleFunctionError(Object.assign(new Error('Non-Response context'),{context:{json:'not a function'}})),/Non-Response context/);
console.log('Sample function error handling checks passed.');
