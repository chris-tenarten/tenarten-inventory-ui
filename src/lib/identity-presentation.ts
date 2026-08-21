export function operationalFirstName(displayName: string | null | undefined) {
  const normalized = displayName?.trim().replace(/\s+/g, " ") ?? "";
  return normalized.split(" ")[0] ?? "";
}
