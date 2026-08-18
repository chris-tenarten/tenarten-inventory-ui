import { createClient } from "npm:@supabase/supabase-js@2.101.1";

const allowedOrigins = (Deno.env.get("TENOPS_ALLOWED_ORIGINS") || "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const json = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": origin,
      "access-control-allow-headers":
        "authorization, apikey, content-type, x-client-info",
      vary: "Origin",
    },
  });

const roles = new Set(["guest", "member", "lead", "developer", "admin"]);

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || allowedOrigins[0];

  if (!allowedOrigins.includes(origin)) {
    return json({ error: "Origin not allowed." }, 403, allowedOrigins[0]);
  }

  if (request.method === "OPTIONS") {
    return json({}, 200, origin);
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, origin);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");

    if (!token) {
      return json({ error: "Authentication required." }, 401, origin);
    }

    const caller = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const { data: userData, error: userError } =
      await caller.auth.getUser(token);

    if (userError || !userData.user) {
      return json({ error: "Authentication required." }, 401, origin);
    }

    const { data: allowed, error: capabilityError } = await caller.rpc(
      "has_app_capability",
      { p_capability: "manageUsers" },
    );

    if (capabilityError || allowed !== true) {
      return json({ error: "Admin access required." }, 403, origin);
    }

    const body = await request.json();

    if (body.action === "list") {
      const { data, error } = await caller.rpc("admin_list_app_users");

      if (error) {
        throw error;
      }

      return json({ users: data ?? [] }, 200, origin);
    }

    if (body.action === "update") {
      if (
        !body.userId ||
        !body.displayName?.trim() ||
        !roles.has(body.role) ||
        typeof body.isActive !== "boolean"
      ) {
        return json(
          { error: "A valid user update is required." },
          400,
          origin,
        );
      }

      const { data, error } = await caller.rpc("admin_set_app_user_access", {
        p_user_id: body.userId,
        p_display_name: body.displayName.trim(),
        p_role: body.role,
        p_is_active: body.isActive,
      });

      if (error) {
        throw error;
      }

      return json({ user: data }, 200, origin);
    }

    if (body.action === "invite") {
      if (
        !body.email?.trim() ||
        !body.displayName?.trim() ||
        !roles.has(body.role)
      ) {
        return json(
          { error: "Email, display name, and role are required." },
          400,
          origin,
        );
      }

      const service = createClient(url, serviceKey, {
        auth: {
          persistSession: false,
        },
      });

      const { data, error } = await service.auth.admin.inviteUserByEmail(
        body.email.trim(),
        {
          redirectTo: `${origin}/?account=recovery`,
          data: {
            display_name: body.displayName.trim(),
          },
        },
      );

      if (error || !data.user) {
        throw error ?? new Error("Invitation failed.");
      }

      const { error: profileError } = await service
        .from("app_users")
        .upsert({
          user_id: data.user.id,
          display_name: body.displayName.trim(),
          role: body.role,
          is_active: true,
          created_by_user_id: userData.user.id,
          updated_by_user_id: userData.user.id,
        });

      if (profileError) {
        await service.auth.admin.deleteUser(data.user.id);
        throw profileError;
      }

      return json({ invited: true }, 200, origin);
    }

    if (body.action === "reset") {
      if (!body.email?.trim()) {
        return json({ error: "Email is required." }, 400, origin);
      }

      const { error } = await caller.auth.resetPasswordForEmail(
        body.email.trim(),
        {
          redirectTo: `${origin}/?account=recovery`,
        },
      );

      if (error) {
        throw error;
      }

      return json({ resetSent: true }, 200, origin);
    }

    return json({ error: "Unsupported action." }, 400, origin);
  } catch (cause) {
    return json(
      {
        error:
          cause instanceof Error ? cause.message : "Admin request failed.",
      },
      500,
      origin,
    );
  }
});