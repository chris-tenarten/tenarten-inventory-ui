import { createClient } from '@supabase/supabase-js';

const keyIndex = process.argv.indexOf('--key');
const communicationKey = keyIndex >= 0 ? process.argv[keyIndex + 1] : '';
if (!communicationKey || !/^[a-z0-9][a-z0-9_]{2,99}$/.test(communicationKey)) {
  throw new Error('Provide one registered release key with --key <communication_key>.');
}
if (process.env.TENOPS_RELEASE_DELIVERY_CONFIRM !== 'DELIVER_TENOPS_RELEASE_COMMUNICATION') {
  throw new Error('Delivery refused. Set TENOPS_RELEASE_DELIVERY_CONFIRM=DELIVER_TENOPS_RELEASE_COMMUNICATION for this intentional release action.');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required. Keep credentials in local environment state only.');
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.rpc('deliver_tenops_release_communication', { p_communication_key: communicationKey });
if (error) throw error;
const result = Array.isArray(data) ? data[0] : data;
console.log(JSON.stringify({ operation: 'deliver-tenops-release-communication', source: new URL(url).origin, ...result }, null, 2));
