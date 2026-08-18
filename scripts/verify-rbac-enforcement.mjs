#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";

const CALLERS = ["anonymous", "guest", "member", "lead", "developer", "admin", "inactive"];

function quotedValues(source) {
  return [...source.matchAll(/"([A-Za-z][A-Za-z0-9]+)"/g)].map((match) => match[1]);
}

function roleCapabilitiesFromSource() {
  const source = fs.readFileSync("src/lib/rbac.ts", "utf8");
  const all = quotedValues(source.match(/export const CAPABILITIES = \[([\s\S]*?)\] as const;/)?.[1] ?? "");
  const resolved = {};
  for (const role of ["guest", "member", "lead", "developer"]) {
    const body = source.match(new RegExp(`const ${role} = \\[([\\s\\S]*?)\\] as const;`))?.[1];
    if (!body) throw new Error(`Unable to read ${role} capabilities from src/lib/rbac.ts.`);
    const inheritedRole = body.match(/\.\.\.(guest|member|lead|developer)/)?.[1];
    resolved[role] = [...(inheritedRole ? resolved[inheritedRole] : []), ...quotedValues(body)];
  }
  if (!all.length) throw new Error("Unable to read the canonical capability list from src/lib/rbac.ts.");
  return { anonymous: [], ...resolved, admin: all, inactive: [] };
}

const ROLE_CAPABILITIES = roleCapabilitiesFromSource();

const ZERO_UUID = "00000000-0000-4000-8000-000000000000";
const cases = [
  { name: "Operational table read", boundary: "PostgREST SELECT jobs", capabilities: ["readOperationalData"], method: "GET", path: "/rest/v1/jobs?select=id&limit=1" },
  { name: "Production Job creation", boundary: "PostgREST INSERT jobs", capabilities: ["createProductionJob"], method: "POST", path: "/rest/v1/jobs", body: {} },
  { name: "Routine Production update", boundary: "PostgREST PATCH jobs", capabilities: ["editProductionJobRoutine"], method: "PATCH", path: `/rest/v1/jobs?id=eq.${ZERO_UUID}`, body: { remarks: "RBAC boundary probe" } },
  { name: "Archive/delete authority", boundary: "PostgREST DELETE jobs", capabilities: ["archiveProductionJob"], method: "DELETE", path: `/rest/v1/jobs?id=eq.${ZERO_UUID}` },
  { name: "Planning mutation", boundary: "PostgREST INSERT planning_items", capabilities: ["modifyPlanning"], method: "POST", path: "/rest/v1/planning_items", body: {} },
  { name: "Job Update creation", boundary: "PostgREST INSERT job_updates", capabilities: ["postJobUpdate"], method: "POST", path: "/rest/v1/job_updates", body: { job_id: ZERO_UUID, author_name: "RBAC probe", body: "RBAC probe", requires_follow_up: false } },
  { name: "Inventory adjustment", boundary: "PostgREST INSERT inventory_transactions", capabilities: ["adjustInventory"], method: "POST", path: "/rest/v1/inventory_transactions", body: {} },
  { name: "Vendor management", boundary: "PostgREST INSERT vendor_catalog_v2", capabilities: ["manageVendorsCatalog"], method: "POST", path: "/rest/v1/vendor_catalog_v2", body: {} },
  { name: "Routine Production RPC", boundary: "RPC save_material_usage_report", capabilities: ["editProductionJobRoutine"], method: "POST", path: "/rest/v1/rpc/save_material_usage_report", body: {} },
  { name: "Production scheduling RPC", boundary: "RPC save_production_schedule_batch", capabilities: ["scheduleProduction"], method: "POST", path: "/rest/v1/rpc/save_production_schedule_batch", body: { p_proposals: [], p_changed_by: "RBAC probe", p_change_note: null, p_batch_id: ZERO_UUID } },
  { name: "Rework mutation RPC", boundary: "RPC create_production_rework", capabilities: ["manageProductionRework"], method: "POST", path: "/rest/v1/rpc/create_production_rework", body: { p_job_id: ZERO_UUID, p_reason_category: "other", p_scope_details: "RBAC boundary probe", p_intake_date: "2099-01-01", p_created_by: "RBAC probe" } },
  { name: "Job Update edit plus assignment", boundary: "RPC edit_job_update", capabilities: ["editJobUpdate", "assignJobUpdate"], method: "POST", path: "/rest/v1/rpc/edit_job_update", body: { p_update_id: ZERO_UUID, p_body: "RBAC probe", p_requires_follow_up: true, p_follow_up_assignee_name: "RBAC probe" } },
  { name: "Job Update resolution", boundary: "RPC resolve_job_update", capabilities: ["resolveJobUpdate"], method: "POST", path: "/rest/v1/rpc/resolve_job_update", body: { p_update_id: ZERO_UUID, p_resolved_by_name: "RBAC probe", p_resolution_message: "RBAC probe" } },
  { name: "Admin RPC", boundary: "RPC admin_list_app_users", capabilities: ["manageUsers"], method: "POST", path: "/rest/v1/rpc/admin_list_app_users", body: {} },
  { name: "Admin access mutation", boundary: "RPC admin_set_app_user_access", capabilities: ["manageUsers"], method: "POST", path: "/rest/v1/rpc/admin_set_app_user_access", body: { p_user_id: ZERO_UUID, p_display_name: "RBAC probe", p_role: "guest", p_is_active: true } },
  { name: "Unknown/unmapped existing RPC denial", boundary: "RPC current_app_display_name", capabilities: null, alwaysDeny: true, method: "POST", path: "/rest/v1/rpc/current_app_display_name", body: {} },
  { name: "PO draft RPC", boundary: "RPC save_chip_purchase_order_draft_v2", capabilities: ["createPurchaseOrderDraft"], method: "POST", path: "/rest/v1/rpc/save_chip_purchase_order_draft_v2", body: {} },
  { name: "PO preview Edge path", boundary: "Edge generate-purchase-order-pdf draft-preview", capabilities: ["previewOperationalDocuments"], method: "POST", path: "/functions/v1/generate-purchase-order-pdf", body: { action: "draft-preview" } },
  { name: "PO issuance Edge path", boundary: "Edge generate-purchase-order-pdf generate", capabilities: ["issuePurchaseOrder"], method: "POST", path: "/functions/v1/generate-purchase-order-pdf", body: { action: "generate" } },
  { name: "Transmittal preview Edge path", boundary: "Edge generate-job-transmittal-pdf draft-preview", capabilities: ["previewOperationalDocuments"], method: "POST", path: "/functions/v1/generate-job-transmittal-pdf", body: { action: "draft-preview" } },
  { name: "Transmittal issuance Edge path", boundary: "Edge generate-job-transmittal-pdf generate", capabilities: ["issueTransmittal"], method: "POST", path: "/functions/v1/generate-job-transmittal-pdf", body: { action: "generate", transmittalId: ZERO_UUID } },
  { name: "Admin Edge boundary", boundary: "Edge admin-manage-users list", capabilities: ["manageUsers"], method: "POST", path: "/functions/v1/admin-manage-users", body: { action: "list" } },
  { name: "Attachment read", boundary: "Storage private object read", capabilities: ["readOperationalData"], method: "GET", path: "/storage/v1/object/authenticated/job-attachments/rbac-enforcement/nonexistent.txt" },
];

function hasCapabilities(caller, required) {
  if (caller === "inactive" || caller === "anonymous") return false;
  const available = ROLE_CAPABILITIES[caller];
  return available.includes("*") || required.every((capability) => available.includes(capability));
}

function expected(caseDefinition, caller) {
  return caseDefinition.alwaysDeny || !hasCapabilities(caller, caseDefinition.capabilities ?? []) ? "DENY" : "ALLOW";
}

function tokenFor(caller) {
  if (caller === "anonymous") return "";
  return process.env[`TENOPS_RBAC_TOKEN_${caller.toUpperCase()}`] ?? "";
}

function authorizationFailure(status, body) {
  return status === 401 || status === 403 || /authentication required|permission denied|not authorized|rbac boundary|tenops permission denied/i.test(body);
}

async function request(baseUrl, anonKey, caller, test) {
  const headers = { apikey: anonKey, "content-type": "application/json" };
  const token = tokenFor(caller);
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${test.path}`, {
    method: test.method,
    headers,
    body: test.body === undefined ? undefined : JSON.stringify(test.body),
  });
  const body = await response.text();
  return { status: response.status, body };
}

async function runReadOnly() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!baseUrl || !anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  for (const caller of CALLERS.filter((name) => name !== "anonymous")) {
    if (!tokenFor(caller)) throw new Error(`TENOPS_RBAC_TOKEN_${caller.toUpperCase()} is required.`);
  }
  let failures = 0;
  for (const test of cases) {
    for (const caller of CALLERS) {
      const wanted = expected(test, caller);
      const actual = await request(baseUrl, anonKey, caller, test);
      const denied = authorizationFailure(actual.status, actual.body);
      const passed = wanted === "DENY" ? denied : !denied;
      console.log(`${passed ? "PASS" : "FAIL"} | ${caller.padEnd(9)} | ${wanted.padEnd(5)} | ${actual.status} | ${test.boundary}`);
      if (!passed) {
        failures += 1;
        console.error(`  ${actual.body.slice(0, 300)}`);
      }
    }
  }
  if (failures) throw new Error(`${failures} RBAC boundary expectation(s) failed.`);
}

async function patchControlledJob(baseUrl, anonKey, caller, jobId, values) {
  return request(baseUrl, anonKey, caller, { method: "PATCH", path: `/rest/v1/jobs?id=eq.${jobId}`, body: values });
}

async function runControlled() {
  if (process.env.TENOPS_RBAC_ACK_CONTROLLED_MUTATIONS !== "YES") {
    throw new Error("Set TENOPS_RBAC_ACK_CONTROLLED_MUTATIONS=YES to acknowledge temporary controlled mutations.");
  }
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const jobId = process.env.TENOPS_RBAC_CONTROLLED_JOB_ID ?? "";
  if (!baseUrl || !anonKey || !jobId) throw new Error("Supabase URL/key and TENOPS_RBAC_CONTROLLED_JOB_ID are required.");
  for (const caller of ["guest", "member", "lead", "developer", "admin", "inactive"]) {
    if (!tokenFor(caller)) throw new Error(`TENOPS_RBAC_TOKEN_${caller.toUpperCase()} is required.`);
  }
  const adminHeaders = { apikey: anonKey, authorization: `Bearer ${tokenFor("admin")}` };
  const sourceResponse = await fetch(`${baseUrl}/rest/v1/jobs?id=eq.${jobId}&select=remarks,customer,planned_start,planned_end,archived_at`, { headers: adminHeaders });
  if (!sourceResponse.ok) throw new Error(`Unable to read controlled Job (${sourceResponse.status}).`);
  const original = (await sourceResponse.json())[0];
  if (!original) throw new Error("Controlled Job was not found.");
  const probes = [
    { label: "routine fields", values: { remarks: `${original.remarks ?? ""} [RBAC ROUTINE PROBE]` }, capability: "editProductionJobRoutine" },
    { label: "elevated fields", values: { customer: `${original.customer ?? ""} [RBAC ELEVATED PROBE]` }, capability: "editProductionJobDetails" },
    { label: "scheduling fields", values: { planned_start: "2099-12-01", planned_end: "2099-12-02" }, capability: "scheduleProduction" },
    { label: "archive field", values: { archived_at: "2099-12-01T00:00:00Z" }, capability: "archiveProductionJob" },
  ];
  try {
    for (const probe of probes) {
      for (const caller of ["guest", "member", "lead", "developer", "admin", "inactive"]) {
        const result = await patchControlledJob(baseUrl, anonKey, caller, jobId, probe.values);
        const wanted = hasCapabilities(caller, [probe.capability]) ? "ALLOW" : "DENY";
        const denied = authorizationFailure(result.status, result.body);
        const passed = wanted === "DENY" ? denied : !denied;
        console.log(`${passed ? "PASS" : "FAIL"} | ${caller.padEnd(9)} | ${wanted.padEnd(5)} | ${probe.label}`);
        if (!passed) throw new Error(`Field-sensitive probe failed for ${caller}/${probe.label}: ${result.status} ${result.body.slice(0, 200)}`);
        await patchControlledJob(baseUrl, anonKey, "admin", jobId, Object.fromEntries(Object.keys(probe.values).map((field) => [field, original[field]])));
      }
    }
  } finally {
    for (const field of ["remarks", "customer", "planned_start", "planned_end", "archived_at"]) {
      await patchControlledJob(baseUrl, anonKey, "admin", jobId, { [field]: original[field] });
    }
  }

  const storagePath = `rbac-enforcement/${crypto.randomUUID()}.txt`;
  for (const caller of ["anonymous", "guest", "member", "lead", "developer", "admin", "inactive"]) {
    const headers = { apikey: anonKey, "content-type": "text/plain" };
    const token = tokenFor(caller);
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}/storage/v1/object/job-attachments/${storagePath}`, { method: "POST", headers, body: "RBAC enforcement probe" });
    const body = await response.text();
    const wanted = hasCapabilities(caller, ["uploadSupportingFiles"]) ? "ALLOW" : "DENY";
    const denied = authorizationFailure(response.status, body);
    const passed = wanted === "DENY" ? denied : !denied;
    console.log(`${passed ? "PASS" : "FAIL"} | ${caller.padEnd(9)} | ${wanted.padEnd(5)} | Storage upload`);
    await fetch(`${baseUrl}/storage/v1/object/job-attachments/${storagePath}`, { method: "DELETE", headers: adminHeaders });
    if (!passed) throw new Error(`Storage upload probe failed for ${caller}: ${response.status} ${body.slice(0, 200)}`);
  }

  for (const caller of ["anonymous", "guest", "member", "lead", "developer", "admin", "inactive"]) {
    const deletePath = `rbac-enforcement/${crypto.randomUUID()}.txt`;
    const seedResponse = await fetch(`${baseUrl}/storage/v1/object/job-attachments/${deletePath}`, {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "text/plain" },
      body: "RBAC delete probe",
    });
    if (!seedResponse.ok) throw new Error(`Unable to seed Storage delete probe (${seedResponse.status}).`);
    const headers = { apikey: anonKey };
    const token = tokenFor(caller);
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}/storage/v1/object/job-attachments/${deletePath}`, { method: "DELETE", headers });
    const body = await response.text();
    const wanted = hasCapabilities(caller, ["deleteSupportingFiles"]) ? "ALLOW" : "DENY";
    const denied = authorizationFailure(response.status, body);
    const passed = wanted === "DENY" ? denied : !denied;
    console.log(`${passed ? "PASS" : "FAIL"} | ${caller.padEnd(9)} | ${wanted.padEnd(5)} | Storage delete`);
    await fetch(`${baseUrl}/storage/v1/object/job-attachments/${deletePath}`, { method: "DELETE", headers: adminHeaders });
    if (!passed) throw new Error(`Storage delete probe failed for ${caller}: ${response.status} ${body.slice(0, 200)}`);
  }
}

function list() {
  console.log("TenOps RBAC enforced-mode adversarial matrix\n");
  for (const test of cases) {
    console.log(`- ${test.boundary} [${test.capabilities?.join(" + ") || "always denied"}]`);
  }
  console.log("\nModes:\n  --run-readonly   Invalid-ID/read-only boundary probes\n  --run-controlled Temporary controlled Job and Storage mutations (explicit acknowledgement required)");
}

const mode = process.argv[2] ?? "--list";
if (mode === "--list") list();
else if (mode === "--run-readonly") await runReadOnly();
else if (mode === "--run-controlled") await runControlled();
else throw new Error(`Unknown mode: ${mode}`);
