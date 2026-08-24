import { createClient } from "@supabase/supabase-js";
import { localAuthQa } from "./local-auth-qa-env.mjs";

const service = createClient(localAuthQa.apiUrl, localAuthQa.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fixtures = [
  {
    email: "pending.user@tenops.local",
    displayName: "Pending User",
    password: undefined,
    emailConfirm: false,
  },
  {
    email: "confirmed.user@tenops.local",
    displayName: "Confirmed User",
    password: "ConfirmedTest!2026",
    emailConfirm: true,
  },
];

const { data: existing, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

for (const fixture of fixtures) {
  const previous = existing.users.find((user) => user.email?.toLowerCase() === fixture.email);
  if (previous) {
    const { error } = await service.auth.admin.deleteUser(previous.id);
    if (error) throw error;
  }

  const { data, error } = await service.auth.admin.createUser({
    email: fixture.email,
    password: fixture.password,
    email_confirm: fixture.emailConfirm,
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create ${fixture.email}`);

  const { error: profileError } = await service.from("app_users").insert({
    user_id: data.user.id,
    display_name: fixture.displayName,
    role: "member",
    is_active: true,
  });
  if (profileError) throw profileError;
}

console.log("Local Auth QA fixtures restored.");
console.log("Pending:   pending.user@tenops.local (no password; use Set up account)");
console.log("Confirmed: confirmed.user@tenops.local / ConfirmedTest!2026");
