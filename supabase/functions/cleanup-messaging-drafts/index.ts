import { createClient } from '@supabase/supabase-js';
import { createHandler } from './core.mjs';
// Deploy with verify_jwt=true (platform default). Dedicated secret is an additional check.
Deno.serve(createHandler({
  secret:Deno.env.get('MESSAGING_CLEANUP_INVOCATION_SECRET'),
  clientFactory:(fetcher:typeof fetch)=>createClient(
    Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetcher}},
  ),
}));
