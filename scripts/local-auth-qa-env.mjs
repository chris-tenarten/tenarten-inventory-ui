import { execFileSync } from "node:child_process";

const workdir = "auth-qa";
const raw = execFileSync(
  "npx",
  ["--yes", "supabase@2.110.0", "status", "--workdir", workdir, "--output", "env"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

const values = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/"$/, "")]),
);

const apiUrl = values.API_URL;
const parsedUrl = apiUrl ? new URL(apiUrl) : null;
if (
  !parsedUrl
  || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)
  || parsedUrl.port !== "54321"
) {
  throw new Error(`Refusing Auth QA operation for non-local Supabase URL: ${apiUrl || "missing"}`);
}

if (!values.ANON_KEY || !values.SERVICE_ROLE_KEY) {
  throw new Error("Local Supabase keys are unavailable. Start the Auth QA stack first.");
}

export const localAuthQa = {
  apiUrl,
  anonKey: values.ANON_KEY,
  serviceRoleKey: values.SERVICE_ROLE_KEY,
};
