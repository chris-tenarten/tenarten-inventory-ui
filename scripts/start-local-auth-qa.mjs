import { spawn } from "node:child_process";
import { localAuthQa } from "./local-auth-qa-env.mjs";

const child = spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: localAuthQa.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: localAuthQa.anonKey,
    NEXT_PUBLIC_RBAC_MODE: "compatibility",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
