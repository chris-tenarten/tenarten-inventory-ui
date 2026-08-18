import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Capability } from "@/lib/rbac";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const serverRbacEnforced = process.env.RBAC_ENFORCED === "true";

export function createServiceClient() {
  if (!url || !serviceRoleKey) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authorizeServerRequest(request: Request, capability: Capability) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    if (!serverRbacEnforced) return null;
    throw new Response("Authentication required.", { status: 401 });
  }
  if (!url || !anonKey) throw new Response("Supabase authentication is not configured.", { status: 500 });
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) throw new Response("Invalid or expired session.", { status: 401 });
  const { data: allowed, error: capabilityError } = await caller.rpc("has_app_capability", { p_capability: capability });
  if (capabilityError || allowed !== true) throw new Response("Permission denied.", { status: 403 });
  return { user: userData.user, token, caller };
}
