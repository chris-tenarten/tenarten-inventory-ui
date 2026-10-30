/** Offline error-contract checks only. No browser, Auth, network or inference. */
import assert from 'node:assert/strict';
import {tenbotFailureMetadata,tenbotFailureTimedOut,tenbotInitializationFailure} from '../src/modules/tenbot/initialization-failure';
const requestId='10302026-0000-4000-8000-000000000001',secret='SECRET_MARKER_private_record_token_document';
const checks:string[]=[];
function check(name:string,run:()=>void){run();checks.push(name);}
function invoice(error:unknown){const result=tenbotInitializationFailure(error,'hosted-invoice-status');assert.deepEqual(Object.keys(result.diagnostic).sort(),['code','requestId','stage','status']);assert(!JSON.stringify(result).includes(secret));assert(result.message.includes('TenBot help remains available.'));assert(!result.message.includes('local'));return result;}
check('transport metadata retains only valid HTTP status, fixed code and UUID request ID',()=>{
 assert.deepEqual(tenbotFailureMetadata(503,{code:'invoice_catalog_unavailable',error:secret,records:[secret]},requestId),{status:503,code:'invoice_catalog_unavailable',requestId});
 for(const code of [secret,'invoice_read_incomplete','catalog_configuration_secret',{},null])assert.deepEqual(tenbotFailureMetadata('503',{code,error:secret},secret),{status:null,code:null,requestId:null});
});
check('401 and 403 offer safe sign-in or permission guidance regardless of server text',()=>{
 assert.match(invoice({status:401,message:secret,code:'invoice_catalog_unavailable'}).message,/sign-in/);
 assert.match(invoice({status:403,message:secret}).message,/current account cannot/);
});
check('only explicit catalog, jobs or configuration codes identify a reference-data failure',()=>{
 assert.match(invoice({status:503,code:'invoice_catalog_unavailable',message:secret,requestId}).message,/material catalog/);
 assert.match(invoice({status:503,code:'invoice_jobs_unavailable',message:secret}).message,/Production Job choices/);
 assert.match(invoice({status:503,code:'invoice_configuration_unavailable',message:secret}).message,/not ready in this environment/);
 assert(!/catalog|configuration/.test(invoice({status:500,message:'catalog config '+secret,code:secret}).message));
});
check('503, 504 and bounded timeout causes use temporary availability guidance without copying caught errors',()=>{
 for(const error of [{status:503,message:secret},{status:504,message:secret},{name:'TimeoutError',message:secret},{name:'FunctionsFetchError',context:{name:'AbortError',message:secret}}])assert.match(invoice(error).message,/temporarily unavailable/);
 assert(tenbotFailureTimedOut({cause:{context:{name:'TimeoutError',message:secret}}}));
 assert(!tenbotFailureTimedOut({cause:{cause:{cause:{name:'TimeoutError'}}}}));
});
check('unknown or malformed failures use generic guidance and cannot populate diagnostics with arbitrary fields',()=>{
 for(const error of [null,undefined,secret,new Error(secret),{status:999,requestId:secret,code:secret,user:secret,document:secret,response:{body:secret}}]){
  const result=invoice(error);assert.match(result.message,/could not be started/);assert.deepEqual(result.diagnostic,{stage:'hosted-invoice-status',status:null,code:null,requestId:null});
 }
});
check('local review and general connection messages stay distinct from hosted invoice failures',()=>{
 const local=tenbotInitializationFailure({message:secret},'local-status'),hosted=tenbotInitializationFailure({message:secret},'hosted-status');
 assert(local.message.includes('local TenBot review workspace'));assert(!hosted.message.includes('local'));assert(hosted.message.includes('rest of TenOps remains available'));assert(!JSON.stringify([local,hosted]).includes(secret));
});
console.log(JSON.stringify({passed:true,groups:checks.length,checks,mode:'Offline classification and diagnostic privacy only',networkCalls:0,operationalWrites:0,inferenceCalls:0},null,2));
