import { createClient } from "npm:@supabase/supabase-js@2.101.1";

export class EdgeAuthorizationError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function requireEdgeCapability(request: Request, capability: string) {
  if (Deno.env.get("RBAC_ENFORCED") !== "true") return null;
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey) throw new EdgeAuthorizationError("Authorization configuration is incomplete.", 500);
  if (!token) throw new EdgeAuthorizationError("Authentication required.", 401);
  const caller = createClient(url, anonKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) throw new EdgeAuthorizationError("Authentication required.", 401);
  const { data: allowed, error } = await caller.rpc("has_app_capability", { p_capability: capability });
  if (error || allowed !== true) throw new EdgeAuthorizationError("This account is not authorized for that action.", 403);
  return userData.user;
}
