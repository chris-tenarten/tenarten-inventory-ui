import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localAuthQa } from "./local-auth-qa-env.mjs";

const mailpitUrl = "http://127.0.0.1:54324";
const pendingEmail = "pending.user@tenops.local";
const confirmedEmail = "confirmed.user@tenops.local";
const pendingPassword = "PendingTest!2026";
const recoveredPassword = "RecoveredTest!2026";

function resetFixtures() {
  execFileSync("node", ["scripts/reset-local-auth-qa.mjs"], { stdio: "ignore" });
}

async function clearMailpit() {
  const response = await fetch(`${mailpitUrl}/api/v1/messages`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Unable to clear local Mailpit (${response.status})`);
  }
}

async function findMessage(subject, recipient) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages`);
    if (!response.ok) throw new Error(`Unable to read local Mailpit (${response.status})`);
    const payload = await response.json();
    const match = payload.messages.find(
      (message) => message.Subject === subject
        && message.To?.some((address) => address.Address === recipient),
    );
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Local Mailpit did not receive ${subject}`);
}

async function consumeCallback(message) {
  const response = await fetch(`${mailpitUrl}/api/v1/message/${message.ID}`);
  if (!response.ok) throw new Error(`Unable to read local message (${response.status})`);
  const payload = await response.json();
  const href = payload.HTML?.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!href?.startsWith(`${localAuthQa.apiUrl}/auth/v1/verify?`)) {
    throw new Error("Local Auth email did not contain the expected local verification link");
  }

  const verification = await fetch(href, { redirect: "manual" });
  const location = verification.headers.get("location");
  if (verification.status !== 303 || !location?.startsWith("http://localhost:3000/")) {
    throw new Error("Local Auth verification did not return the expected localhost callback");
  }

  const callback = new URL(location);
  const hash = new URLSearchParams(callback.hash.slice(1));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) throw new Error("Local callback did not establish an Auth session");
  return { accessToken, refreshToken, account: callback.searchParams.get("account") };
}

async function verifyPasswordFlow({ email, kind, subject, password }) {
  const client = createClient(localAuthQa.apiUrl, localAuthQa.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (kind === "setup") {
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: "http://localhost:3000/?account=setup" },
    });
    if (error) throw error;
  } else {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/?account=recovery",
    });
    if (error) throw error;
  }

  const message = await findMessage(subject, email);
  const callback = await consumeCallback(message);
  if (callback.account !== kind) throw new Error(`${kind} callback lost its account-flow marker`);

  const { error: sessionError } = await client.auth.setSession({
    access_token: callback.accessToken,
    refresh_token: callback.refreshToken,
  });
  if (sessionError) throw sessionError;

  const { error: updateError } = await client.auth.updateUser({ password });
  if (updateError) throw updateError;
  const { error: signOutError } = await client.auth.signOut({ scope: "local" });
  if (signOutError) throw signOutError;

  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || signedIn.user?.email !== email) {
    throw signInError ?? new Error(`${kind} password could not be used for normal sign-in`);
  }
  const { data: profile, error: profileError } = await client.rpc("get_my_app_user");
  if (profileError || !Array.isArray(profile) || profile.length !== 1 || profile[0].is_active !== true) {
    throw profileError ?? new Error(`${kind} account did not resolve its local app profile`);
  }
  await client.auth.signOut({ scope: "local" });
}

resetFixtures();
try {
  await clearMailpit();
  await verifyPasswordFlow({
    email: pendingEmail,
    kind: "setup",
    subject: "Set up your TenOps account",
    password: pendingPassword,
  });
  await verifyPasswordFlow({
    email: confirmedEmail,
    kind: "recovery",
    subject: "Set or reset your TenOps password",
    password: recoveredPassword,
  });
  console.log("Local pending-account setup flow passed.");
  console.log("Local confirmed-account recovery flow passed.");
} finally {
  resetFixtures();
}
