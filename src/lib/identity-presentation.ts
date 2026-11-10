export function operationalFirstName(displayName: string | null | undefined) {
  const normalized = displayName?.trim().replace(/\s+/g, " ") ?? "";
  return normalized.split(" ")[0] ?? "";
}

export function accountInitials(displayName: string | null | undefined) {
  const words = (displayName?.trim().replace(/\s+/g, " ") ?? "").split(" ").filter(Boolean);
  if (words.length === 0) return "TO";
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words.at(-1)?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase() || "TO";
}
