import { createClient } from '@supabase/supabase-js';
import {browserAuthStorage,createActionSessionStorage} from './auth-action-session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const actionSessionStorage=createActionSessionStorage(browserAuthStorage());
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    ...(actionSessionStorage.storage?{storage:actionSessionStorage.storage}:{}),
  },
});
