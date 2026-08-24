import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const rbac = read("src/lib/rbac.ts");
const infra = read("supabase/migrations/20260818_001_rbac_identity_infrastructure.sql");
const enforcement = read("supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql");
const rollback = read("supabase/rollback/20260818_002_rbac_final_enforcement_rollback.sql");
const compatibility = read("supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql");
const edgeRbac = read("supabase/functions/_shared/rbac.ts");
const purchaseOrderEdge = read("supabase/functions/generate-purchase-order-pdf/index.ts");
const transmittalEdge = read("supabase/functions/generate-job-transmittal-pdf/index.ts");
const enforcementHarness = read("scripts/verify-rbac-enforcement.mjs");
const compatibilitySupport = read("supabase/migrations/20260818_004_final_compatibility_support.sql");
const jobUpdateDeletion = read("supabase/migrations/20260821_001_job_update_deletion.sql");
const authProvider = read("src/lib/auth.tsx");
const notifications = read("src/components/AccountNotifications.tsx");
const accountAccess = read("src/components/AccountAccessPanel.tsx");
const adminSettings = read("src/components/AdminSettingsPanel.tsx");
const adminEdge = read("supabase/functions/admin-manage-users/index.ts");
const settingsPage = read("src/app/settings/page.tsx");
const clientShell = read("src/app/client-layout-shell.tsx");
const welcomeHero = read("src/components/WelcomeHero.tsx");

function assert(condition, message) { if (!condition) throw new Error(message); }

for (const role of ["guest", "member", "lead", "developer", "admin"]) assert(rbac.includes(`"${role}"`), `Missing role ${role}`);
assert(rbac.includes('"manageProductionRework"'), "Missing Rework capability");
assert(rbac.includes('"deleteJobUpdate"'), "Missing Admin Job Update deletion capability");
assert(!/const member = \[[\s\S]*?deleteJobUpdate[\s\S]*?\] as const;/.test(rbac), "Member must not inherit delete-any Job Update authority");
assert(jobUpdateDeletion.includes("values ('admin', 'deleteJobUpdate')"), "Only Admin receives delete-any Job Update authority");
assert(jobUpdateDeletion.includes("selected_update.author_user_id is distinct from caller_user.user_id"), "Canonical authorship must govern own-update deletion");
assert(/const developer = \[\.\.\.guest, "accessDevelopmentEnvironment"\]/.test(rbac), "Developer must not inherit production authority");
assert(/const lead = \[[\s\S]*"manageProductionRework"/.test(rbac), "Lead must manage Rework");
assert(!/const member = \[[\s\S]*"manageProductionRework"/.test(rbac.split("const lead")[0]), "Member must not manage Rework");
assert(infra.includes("production_rework_cycles"), "Infrastructure must attribute Rework actors");
assert(!infra.includes("revoke usage on schema public from anon"), "Compatibility migration must not revoke anon schema access");
for (const name of ["create_production_rework", "update_production_rework_status", "save_production_rework_schedule_batch", "save_production_rework_mixed_schedule_batch"]) {
  assert(enforcement.includes(`public.${name}`), `Enforcement missing ${name}`);
}
assert(enforcement.includes("require_app_capability('manageProductionRework')"), "Rework wrappers must enforce capability");
assert(enforcement.includes("DO NOT APPLY"), "Enforcement migration must be unmistakably isolated");
assert(enforcement.includes("pgrst.db_pre_request = 'public.tenops_authorize_request'"), "Final enforcement must install the trusted PostgREST boundary");
assert(enforcement.includes("grant execute on function public.tenops_authorize_request() to anon, authenticated, service_role"), "PostgREST JWT roles must be able to invoke the pre-request boundary");
assert(enforcement.includes("revoke usage on schema public from anon"), "Final enforcement must retire anonymous public-schema authority");
assert(enforcement.includes("RBAC read job attachment objects"), "Final enforcement must replace Storage compatibility policies");
assert(enforcement.includes("second_capability := 'assignJobUpdate'"), "Editing Job Update assignment must require assignment authority");
assert(rollback.includes("alter role authenticator reset pgrst.db_pre_request"), "Rollback must remove the PostgREST request hook");
assert(rollback.includes('grant usage on schema public to anon, authenticated'), "Rollback must restore compatibility schema access");
assert(rollback.includes('grant execute on function public.bootstrap_first_tenops_admin(text) to authenticated'), "Rollback must restore the _001 bootstrap grant");
assert(rollback.includes('create policy "Compatibility authenticated read jobs"'), "Rollback must restore _003 Job compatibility");
for (const policyName of [...compatibility.matchAll(/create policy\s+"([^"]+)"/gi)].map((match) => match[1])) {
  assert(rollback.includes(`create policy "${policyName}"`), `Rollback missing _003 policy ${policyName}`);
}
for (const policyName of [
  "Compatibility read Production Rework", "Purchasing reference read", "Vendor contact read",
  "Purchase Order read", "Purchase Order line read", "Chip PO detail read",
  "Purchase Order issuance read", "Purchase Order document read",
]) assert(rollback.includes(`create policy "${policyName}"`), `Rollback missing combined compatibility policy ${policyName}`);
assert(rollback.includes('create policy "Allow anon read job attachment objects"'), "Rollback must restore legacy Storage access");
assert(rollback.includes('create policy "Compatibility authenticated read job attachment objects"'), "Rollback must restore authenticated Storage access");
assert(rollback.includes('rename to create_production_rework'), "Rollback must restore the original Rework implementation name");
for (const table of ["inventory_items", "inventory_transactions", "pending_receivals", "vendor_catalog", "vendor_catalog_v2"]) {
  assert(rollback.includes(`alter table public.${table} disable row level security`), `Rollback must restore pre-_002 RLS state for ${table}`);
}
assert(rollback.includes("notify pgrst, 'reload config'"), "Rollback must reload PostgREST config");
assert(rollback.includes("notify pgrst, 'reload schema'"), "Rollback must reload PostgREST schema");
for (const table of [
  "jobs", "job_activity", "job_attachments", "job_updates", "production_rework_cycles",
  "planning_phases", "planning_items", "planning_phase_library", "planning_phase_library_items",
  "manpower_workers", "manpower_tasks", "manpower_entries", "manpower_reporting_groups",
  "inventory_items", "inventory_transactions", "pending_receivals", "material_usage_reports",
  "material_usage_lines", "vendors", "vendor_contacts", "vendor_catalog", "vendor_catalog_v2",
  "purchase_orders", "purchase_order_lines", "chip_purchase_order_line_details",
  "purchase_order_issuances", "purchase_order_documents", "job_transmittals",
]) assert(enforcement.includes(`'${table}'`), `Final enforcement missing operational table ${table}`);
for (const rpc of [
  "save_production_schedule_batch", "save_production_planning_schedule_batch",
  "create_production_rework", "update_production_rework_status",
  "save_production_rework_schedule_batch", "save_production_rework_mixed_schedule_batch",
  "resolve_job_update", "edit_job_update", "save_material_usage_report",
  "delete_material_usage_report", "delete_empty_manpower_reporting_group",
  "reserve_inventory_quantity", "release_inventory_reservation",
  "release_inventory_reservations_bulk", "receive_pending_receival_with_reservation",
  "undo_pending_receival_receipt", "save_chip_purchase_order_draft_v2",
  "delete_purchase_order_draft", "issue_purchase_order", "save_vendor_profile",
  "save_vendor_contact", "save_purchasing_catalog_item", "issue_job_transmittal",
  "preview_next_job_document_number", "list_job_transmittals",
]) assert(enforcement.includes(`'${rpc}'`), `Final enforcement missing browser RPC ${rpc}`);
assert(edgeRbac.includes('Deno.env.get("RBAC_ENFORCED") !== "true"'), "Edge enforcement must remain dormant during compatibility mode");
assert(compatibilitySupport.includes("unique (user_id, notification_key)"), "Welcome notifications need durable per-user idempotency");
assert(compatibilitySupport.includes("'account-welcome-v1'"), "Welcome notification key must be deterministic");
assert(compatibilitySupport.includes("Welcome to TenOps, ' || btrim(selected_user.display_name)"), "Welcome title must use canonical display name");
assert(compatibilitySupport.includes("jsonb_build_object('role', selected_user.role)"), "Welcome metadata must use canonical role");
assert(authProvider.includes('supabase.rpc("ensure_my_welcome_notification")'), "Authenticated profile load must ensure the welcome notification");
assert(notifications.includes('supabase.rpc("list_my_account_notification_history"'), "Header notifications must include retained account-notification history");
assert(notifications.includes('supabase.rpc("mark_my_account_notification_read"'), "Account notices must support canonical read state");
assert(notifications.includes('item.notification_type === "welcome"'), "Welcome notification must open the retained onboarding entry point");
assert(notifications.includes('auth.profile?.displayName'), "Welcome onboarding must use the canonical account display name");
assert(notifications.includes('ROLE_LABELS[auth.profile.role]'), "Welcome onboarding must use the canonical role");
assert(clientShell.includes('data-account-identity'), "Authenticated header must expose compact account identity");
assert(clientShell.includes('operationalFirstName(auth.profile.displayName)'), "Header identity must present the canonical display_name as an operational first name");
assert(clientShell.includes('ROLE_LABELS[auth.profile.role]'), "Header identity must use canonical role");
assert(welcomeHero.includes('welcome.read_at === null'), "Automatic Welcome hero must be account-scoped to unread durable Welcome state");
assert(!welcomeHero.includes('mark_my_account_notification_read'), "Hero completion must not mutate durable Welcome read state");
assert(welcomeHero.includes('tenops:start-notification-onboarding'), "Hero completion must teach the real Notification path");
assert(settingsPage.includes('<AccountAccessPanel onAuthenticated={() => {}} showEyebrow={false} />'), "Unlocked Settings must expose Account Access");
assert(clientShell.includes('<AccountAccessPanel onAuthenticated={() => {}} showCutoverNotice separated={false} />'), "Locked shell must expose account authentication and cutover guidance without the obsolete compatibility divider");
assert(clientShell.includes('max-w-lg') && clientShell.includes('sm:max-w-2xl') && clientShell.includes('lg:max-w-3xl'), "Login must retain compact mobile sizing and restore the larger desktop composition");
assert(clientShell.includes('sm:h-40') && clientShell.includes('lg:h-44'), "Login branding must scale up at desktop breakpoints");
assert(accountAccess.includes('separated ? "mt-5 border-t border-slate-300 pt-5" : ""'), "Account Access must support an unseparated login embedding without changing Settings separation");
assert(clientShell.includes('auth.isAuthenticated && auth.accessAllowed'), "Application access must require an authenticated allowed account");
assert(!clientShell.includes('BRANDING.accessPassword') && !clientShell.includes('BRANDING.accessStorageKey'), "Legacy browser-password bypass must be removed");
assert(!clientShell.includes('handleUnlock') && !clientShell.includes('showAccessModal'), "Legacy Internal Access UI must be removed");
assert(accountAccess.includes('auth.isAuthenticated && !auth.requiresPasswordSetup'), "Authenticated Settings must show account identity instead of sign-in fields");
assert(accountAccess.includes('Sign out of account'), "Authenticated Account Access must retain account sign-out");
assert(accountAccess.includes('Need to set or reset your password?'), "Login must expose self-service account setup and recovery");
assert(accountAccess.includes('Set up account') && accountAccess.includes('Reset password'), "Pending setup and enrolled recovery must use distinct supported flows");
assert(accountAccess.includes('window.sessionStorage.setItem(CUTOVER_NOTICE_KEY'), "Cutover notice dismissal must remain browser-session local");
assert(accountAccess.includes('aria-modal="true"') && accountAccess.includes('Got it'), "Cutover guidance must use the dismissible login modal");
assert(accountAccess.includes("The legacy TenOps access method has been disabled."), "Post-cutover notice must describe legacy access accurately");
assert(accountAccess.includes("Use this if you have a TenOps account but haven&apos;t set your password yet."), "Setup choice must explain pending-account use");
assert(accountAccess.includes("Use this if you previously signed in but need a new password."), "Recovery choice must explain enrolled-account use");
assert(authProvider.includes('supabase.auth.resend({') && authProvider.includes('type: "signup"'), "Pending accounts must receive a fresh signup verification email");
assert(authProvider.includes('supabase.auth.resetPasswordForEmail'), "Enrolled accounts must retain password recovery");
assert(authProvider.includes('accountFlow === "setup" || accountFlow === "recovery"'), "Both account email callbacks must enter password setup");
assert(!accountAccess.includes('Supabase'), "Operator-facing account copy must not expose implementation terminology");
assert(!authProvider.includes('auth.admin.'), "Browser Auth provider must not expose privileged Admin APIs");
assert(adminSettings.includes('auth.isAuthenticated && Boolean(auth.profile?.isActive) && auth.can("manageUsers")'), "Admin Settings must require an authenticated active capable profile");
assert(adminSettings.includes("FunctionsHttpError"), "Admin Settings must read safe Edge Function error responses");
assert(adminSettings.includes("payload.error?.message"), "Admin Settings must display the structured safe error message");
for (const code of [
  "invite_rate_limited", "user_already_exists", "invalid_email",
  "auth_provider_failure", "auth_configuration_failure",
  "profile_provisioning_failed", "unexpected_failure",
]) assert(adminEdge.includes(code), `Admin Edge Function missing safe error code ${code}`);
assert(adminEdge.includes('stage: "auth_invite"') || adminEdge.includes('"auth_invite"'), "Admin Edge Function must log the Auth invite stage");
assert(adminEdge.includes('"app_user_provisioning"'), "Admin Edge Function must log the profile provisioning stage");
for (const source of [purchaseOrderEdge, transmittalEdge]) {
  assert(source.includes("requireEdgeCapability"), "Document Edge Function missing trusted capability check");
}
assert(enforcementHarness.includes('fs.readFileSync("src/lib/rbac.ts"'), "Enforcement matrix must read canonical role capabilities");
for (const caller of ["anonymous", "guest", "member", "lead", "developer", "admin", "inactive"]) {
  assert(enforcementHarness.includes(`"${caller}"`), `Enforcement matrix missing ${caller} caller state`);
}
for (const boundary of [
  "PostgREST SELECT jobs", "PostgREST INSERT jobs", "PostgREST PATCH jobs", "PostgREST DELETE jobs",
  "RPC save_material_usage_report", "RPC save_production_schedule_batch", "RPC create_production_rework", "RPC edit_job_update",
  "RPC save_chip_purchase_order_draft_v2",
  "RPC admin_set_app_user_access", "RPC current_app_display_name", "Storage private object read",
  "generate-purchase-order-pdf", "generate-job-transmittal-pdf", "admin-manage-users",
]) assert(enforcementHarness.includes(boundary), `Enforcement matrix missing ${boundary}`);
assert(enforcementHarness.includes("TENOPS_RBAC_ACK_CONTROLLED_MUTATIONS"), "Controlled mutation probes require explicit acknowledgement");
assert(enforcementHarness.includes("planned_start: \"2099-12-01\", planned_end: \"2099-12-02\""), "Scheduling probe must preserve a valid date interval");
for (const delegatedCall of [
  "rbac_legacy_create_production_rework", "rbac_legacy_update_production_rework_status",
  "rbac_legacy_save_production_rework_schedule_batch", "rbac_legacy_save_production_rework_mixed_schedule_batch",
]) assert(enforcement.includes(delegatedCall), `Rework wrapper must delegate to ${delegatedCall}`);
console.log("RBAC source verification passed.");
