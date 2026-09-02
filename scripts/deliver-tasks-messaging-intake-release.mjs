import {createClient} from '@supabase/supabase-js';

const CONFIRMATION='DELIVER_TASKS_MESSAGING_INTAKE_RELEASE';
const communication={communication_key:'tasks_messaging_intake_20260902',channel:'account_notification',title:"What's new in TenOps",body:'Tasks, Messaging, and Intake are now available as connected operational workspaces.',destination:'/',deliver_to_future_users:false,is_active:true};
if(process.env.TENOPS_RELEASE_DELIVERY_CONFIRM!==CONFIRMATION)throw new Error(`Delivery refused. Set TENOPS_RELEASE_DELIVERY_CONFIRM=${CONFIRMATION}.`);
const url=process.env.NEXT_PUBLIC_SUPABASE_URL??process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Hosted Supabase URL and service-role credentials are required.');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const existing=await supabase.from('tenops_release_communications').select('communication_key,channel,title,body,destination,deliver_to_future_users,is_active').eq('communication_key',communication.communication_key).maybeSingle();
if(existing.error)throw existing.error;
if(existing.data){for(const [field,value] of Object.entries(communication)){if(existing.data[field]!==value)throw new Error(`Existing release communication differs at ${field}; delivery stopped.`);}}
else{const inserted=await supabase.from('tenops_release_communications').insert(communication);if(inserted.error)throw inserted.error;}
const delivered=await supabase.rpc('deliver_tenops_release_communication',{p_communication_key:communication.communication_key});
if(delivered.error)throw delivered.error;
console.log(JSON.stringify({operation:'deliver-tasks-messaging-intake-release',source:new URL(url).origin,result:Array.isArray(delivered.data)?delivered.data[0]:delivered.data},null,2));
