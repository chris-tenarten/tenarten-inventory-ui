// Public development defaults; actual personnel are configured privately.
export const PRODUCTION_PERSONNEL = [
  { key: "person-1", displayName: "Person 1" },
  { key: "person-2", displayName: "Person 2" },
  { key: "person-3", displayName: "Person 3" },
  { key: "person-4", displayName: "Person 4" },
  { key: "person-5", displayName: "Person 5" },
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
