import { createClient } from 'npm:@supabase/supabase-js@2.101.1';
import { createHandler } from './core.mjs';
Deno.serve(createHandler({
 origins:['https://tenops.pages.dev','https://tendev.pages.dev','http://localhost:3000'],
 clientFactory:(authorization:string,fetcher:typeof fetch)=>({
  caller:createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization},fetch:fetcher}}),
  service:createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetcher}}),
 }),
}));
