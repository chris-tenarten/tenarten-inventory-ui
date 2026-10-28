// The existing Manpower accounting rule: round each AM and PM component to
// integer hundredths before adding. Do not sum binary floating-point hours.
export const entryHundredths = entry =>
  Math.round(Number(entry.am_hours) * 100) + Math.round(Number(entry.pm_hours) * 100);
export const laborHours = entries =>
  entries.reduce((sum, entry) => sum + entryHundredths(entry), 0) / 100;
