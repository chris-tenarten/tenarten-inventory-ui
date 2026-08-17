export const PRODUCTION_PERSONNEL = [
  { key: "anthony", displayName: "Anthony" },
  { key: "chris", displayName: "Chris" },
  { key: "gio", displayName: "Gio" },
  { key: "marcos", displayName: "Marcos" },
  { key: "pat", displayName: "Pat" },
] as const;

export const PRODUCTION_PERSONNEL_NAMES = PRODUCTION_PERSONNEL.map(
  ({ displayName }) => displayName,
);

const PRODUCTION_PERSONNEL_ORDER = new Map<string, number>(
  PRODUCTION_PERSONNEL_NAMES.map((name, index) => [name, index]),
);

export function compareProductionPersonnelNames(first: string, second: string) {
  const firstOrder = PRODUCTION_PERSONNEL_ORDER.get(first) ?? Number.MAX_SAFE_INTEGER;
  const secondOrder = PRODUCTION_PERSONNEL_ORDER.get(second) ?? Number.MAX_SAFE_INTEGER;
  return firstOrder - secondOrder || first.localeCompare(second);
}
