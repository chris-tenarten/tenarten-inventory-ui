export const APP_ROLES = ["guest", "member", "lead", "developer", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const CAPABILITIES = [
  "readOperationalData",
  "createProductionJob",
  "editProductionJobRoutine",
  "editProductionJobDetails",
  "archiveProductionJob",
  "scheduleProduction",
  "manageProductionRework",
  "modifyPlanning",
  "managePhaseLibrary",
  "postJobUpdate",
  "editJobUpdate",
  "deleteJobUpdate",
  "assignJobUpdate",
  "resolveJobUpdate",
  "uploadSupportingFiles",
  "deleteSupportingFiles",
  "createPurchaseOrderDraft",
  "issuePurchaseOrder",
  "previewOperationalDocuments",
  "issueTransmittal",
  "receiveInventory",
  "adjustInventory",
  "manageVendorsCatalog",
  "accessDevelopmentEnvironment",
  "manageUsers",
  "manageRolesPermissions",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const guest = ["readOperationalData", "previewOperationalDocuments"] as const;
const member = [
  ...guest,
  "createProductionJob",
  "editProductionJobRoutine",
  "modifyPlanning",
  "postJobUpdate",
  "editJobUpdate",
  "assignJobUpdate",
  "resolveJobUpdate",
  "uploadSupportingFiles",
  "deleteSupportingFiles",
  "createPurchaseOrderDraft",
  "receiveInventory",
] as const;
const lead = [
  ...member,
  "editProductionJobDetails",
  "archiveProductionJob",
  "scheduleProduction",
  "manageProductionRework",
  "managePhaseLibrary",
  "issuePurchaseOrder",
  "issueTransmittal",
  "adjustInventory",
  "manageVendorsCatalog",
] as const;
const developer = [...guest, "accessDevelopmentEnvironment"] as const;

export const ROLE_CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  guest,
  member,
  lead,
  developer,
  admin: CAPABILITIES,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  guest: "Guest",
  member: "Member",
  lead: "Lead",
  developer: "Developer",
  admin: "Admin",
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  readOperationalData: "View operational data",
  createProductionJob: "Create Production Jobs",
  editProductionJobRoutine: "Update routine Production details",
  editProductionJobDetails: "Edit elevated Production Job details",
  archiveProductionJob: "Archive and restore Production Jobs",
  scheduleProduction: "Schedule Production",
  manageProductionRework: "Create and manage Rework",
  modifyPlanning: "Modify Planning",
  managePhaseLibrary: "Manage Phase Library",
  postJobUpdate: "Post Job Updates",
  editJobUpdate: "Edit Job Updates",
  deleteJobUpdate: "Delete Job Updates",
  assignJobUpdate: "Assign Job Updates",
  resolveJobUpdate: "Resolve Job Updates",
  uploadSupportingFiles: "Upload supporting files",
  deleteSupportingFiles: "Delete supporting files",
  createPurchaseOrderDraft: "Create Purchase Order drafts",
  issuePurchaseOrder: "Issue Purchase Orders",
  previewOperationalDocuments: "Preview operational documents",
  issueTransmittal: "Issue Letters of Transmittal",
  receiveInventory: "Receive Inventory",
  adjustInventory: "Adjust Inventory",
  manageVendorsCatalog: "Manage vendors and catalog",
  accessDevelopmentEnvironment: "Access development environment",
  manageUsers: "Manage users and access",
  manageRolesPermissions: "Manage roles and permissions",
};

export const RBAC_MODE =
  process.env.NEXT_PUBLIC_RBAC_MODE === "enforced" ? "enforced" : "compatibility";

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function roleHasCapability(role: AppRole, capability: Capability) {
  return ROLE_CAPABILITIES[role].includes(capability);
}
