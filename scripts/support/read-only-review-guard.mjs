/** Local review only. No application imports, credentials, or permissive fallback. */
export const PREFIX='/__review_supabase';
export const SAFE_RPCS=new Set([
 'get_my_app_access','get_my_account_preferences','list_my_account_notifications',
 'list_my_work_conversations_v11','list_my_work_message_page_v11','list_my_work_inbox_recipients',
 'list_my_work_tasks','list_my_work_task_groups','list_my_work_task_group_memberships',
]);
export const SAFE_TABLES=new Set([
 'jobs','job_activity','job_attachments','job_updates','production_rework_cycles',
 'inventory_items','inventory_transactions','pending_receivals','vendor_catalog','vendor_catalog_v','vendors',
 'manpower_entries','manpower_product_categories','manpower_reporting_groups','material_usage_reports','material_usage_lines',
 'my_work_messages','work_tasks','work_task_attachments','planning_items','planning_phase_library','planning_phase_library_items','planning_phases',
 'production_companies','production_contacts','purchase_orders','purchase_order_documents','purchase_order_issuances',
 'proposals','proposal_lines','proposal_estimates','bid_proposal_relationships','sample_operational_profiles',
]);
export const CSP="default-src 'self'; connect-src 'self' ws://localhost:3000; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'none'; object-src 'none'; frame-src 'none'; form-action 'self'; base-uri 'self'";
export function planRequest(raw,method,body={}) {
 const url=new URL(raw,'http://localhost:3000');
 if(!url.pathname.startsWith(PREFIX+'/'))return null;
 const path=url.pathname.slice(PREFIX.length);
 // Encoded paths, path overrides, schema changes and arbitrary endpoints fail closed.
 if(/%|\\|\/\//.test(path))return null;
 if(path==='/auth/v1/token'&&method==='POST'&&['password','refresh_token'].includes(url.searchParams.get('grant_type')))return {path:path+url.search,method,body,kind:'auth'};
 if(path==='/auth/v1/user'&&method==='GET')return {path,method,kind:'auth'};
 if(path==='/auth/v1/logout'&&method==='POST'&&url.searchParams.get('scope')==='local')return {path:path+url.search,method,body,kind:'auth'};
 const rpc=/^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(path);
 if(rpc&&SAFE_RPCS.has(rpc[1])&&['POST','GET','HEAD'].includes(method)){
  if(method==='POST')for(const [key,value] of Object.entries(body)){
   if(!/^p_[a-z_]+$/.test(key))return null;
   if(value===null)continue; // Approved RPCs use null defaults for optional arguments.
   if(Array.isArray(value)){
    if(!value.every(v=>typeof v==='string'&&/^[a-f0-9-]+$/i.test(v)))return null;
    url.searchParams.set(key,'{'+value.join(',')+'}');
   }else if(['string','number','boolean'].includes(typeof value))url.searchParams.set(key,String(value));
   else return null;
  }
  // Defense in depth: even allowlisted RPCs run in PostgREST's GET read-only transaction.
  return {path:path+url.search,method:method==='HEAD'?'HEAD':'GET',kind:'read'};
 }
 const table=/^\/rest\/v1\/([a-z_]+)$/.exec(path);
 if(table&&SAFE_TABLES.has(table[1])&&['GET','HEAD'].includes(method))return {path:path+url.search,method,kind:'read'};
 return null; // All Storage, Realtime, Edge Functions and unknown RPCs denied.
}
export function forwardHeaders(input,anonKey){
 const headers={apikey:anonKey};
 for(const name of ['authorization','accept','range','range-unit','x-client-info'])if(input[name])headers[name]=input[name];
 if(input.prefer?.split(',').some(p=>p.trim().startsWith('count=')))headers.prefer=input.prefer.split(',').filter(p=>/^count=(exact|planned|estimated)$/.test(p.trim())).join(',');
 headers['accept-profile']='public';
 return headers;
}
export const banner='<style data-read-only-review>body::before{content:"READ-ONLY REVIEW · Saving, sending and uploading are disabled. Draft text saves locally.";position:fixed;bottom:10px;right:10px;z-index:9999;max-width:390px;background:#fef9c3;color:#713f12;padding:6px 10px;border:1px solid #fde047;border-radius:4px;font:11px system-ui;pointer-events:none}</style>';
