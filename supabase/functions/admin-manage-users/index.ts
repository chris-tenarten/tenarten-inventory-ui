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

type SafeError = {
  code: string;
  message: string;
  status: number;
};

function errorDetails(cause: unknown) {
  const source = cause && typeof cause === "object"
    ? cause as Record<string, unknown>
    : {};
  return {
    code: typeof source.code === "string" ? source.code : "",
    message: cause instanceof Error ? cause.message : "",
    status: typeof source.status === "number" ? source.status : 0,
  };
}

function classifyInviteError(cause: unknown): SafeError {
  const details = errorDetails(cause);
  const code = details.code.toLowerCase();
  const message = details.message.toLowerCase();

  if (
    details.status === 429 ||
    code.includes("rate_limit") ||
    message.includes("rate limit")
  ) {
    return {
      code: "invite_rate_limited",
      message: "Invitation email rate limit reached. Please wait before trying again.",
      status: 429,
    };
  }

  if (
    code.includes("already_exists") ||
    code.includes("email_exists") ||
    message.includes("already been registered") ||
    message.includes("already exists")
  ) {
    return {
      code: "user_already_exists",
      message: "A user with this email address already exists.",
      status: 409,
    };
  }

  if (
    code.includes("email_address_invalid") ||
    code.includes("validation_failed") ||
    message.includes("invalid email") ||
    message.includes("valid email")
  ) {
    return {
      code: "invalid_email",
      message: "Enter a valid email address.",
      status: 400,
    };
  }

  if (
    details.status >= 500 ||
    code.includes("unexpected_failure") ||
    message.includes("error sending") ||
    message.includes("smtp")
  ) {
    return {
      code: "auth_provider_failure",
      message: "Supabase could not send the invitation email. Check the Auth email provider and redirect configuration.",
      status: 503,
    };
  }

  return {
    code: "invitation_failed",
    message: "The invitation could not be sent. Please verify the email address and try again.",
    status: 400,
  };
}

function logFailure(
  requestId: string,
  action: string,
  stage: string,
  cause: unknown,
  safeError: SafeError,
) {
  const details = errorDetails(cause);
  console.error(JSON.stringify({
    event: "admin_manage_users_failure",
    requestId,
    action,
    stage,
    safeCode: safeError.code,
    providerCode: details.code || undefined,
    providerStatus: details.status || undefined,
  }));
}

const errorResponse = (
  error: SafeError,
  origin: string,
  requestId: string,
) => json({ error: { code: error.code, message: error.message }, requestId }, error.status, origin);

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
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
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      const safeError = {
        code: "auth_configuration_failure",
        message: "User administration is not configured correctly.",
        status: 503,
      };
      logFailure(requestId, "initialize", "configuration", new Error("Required Supabase credential is unavailable."), safeError);
      return errorResponse(safeError, origin, requestId);
    }

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
        const cause = error ?? new Error("Invitation returned no user.");
        const safeError = classifyInviteError(cause);
        logFailure(requestId, "invite", "auth_invite", cause, safeError);
        return errorResponse(safeError, origin, requestId);
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
        const rollback = await service.auth.admin.deleteUser(data.user.id);
        const safeError = {
          code: "profile_provisioning_failed",
          message: rollback.error
            ? "The Auth invitation was created, but TenOps access could not be provisioned. Contact an administrator before retrying."
            : "TenOps access could not be provisioned. The incomplete invitation was rolled back safely.",
          status: 500,
        };
        logFailure(requestId, "invite", "app_user_provisioning", profileError, safeError);
        if (rollback.error) {
          logFailure(requestId, "invite", "auth_invite_rollback", rollback.error, safeError);
        }
        return errorResponse(safeError, origin, requestId);
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
    const safeError = {
      code: "unexpected_failure",
      message: "An unexpected user administration error occurred.",
      status: 500,
    };
    logFailure(requestId, "unknown", "unexpected", cause, safeError);
    return errorResponse(safeError, origin, requestId);
  }
});
