export type SnapshotPeriod = { key: 'last_30_days'; start: string; end: string };

export function last30Days(now = new Date()): SnapshotPeriod {
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(local);
  start.setDate(start.getDate() - 29);
  const key = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { key: 'last_30_days', start: key(start), end: key(local) };
}
