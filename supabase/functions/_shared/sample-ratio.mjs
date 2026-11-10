const numericPart = (value) => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function normalizeSupportedSampleRatio(resinParts, hardenerParts) {
  const resin = numericPart(resinParts);
  const hardener = numericPart(hardenerParts);
  if (resin === null || hardener === null) return null;
  const ratio = resin / hardener;
  if (Math.abs(ratio - 5) <= 1e-9) return "5:1";
  if (Math.abs(ratio - 4) <= 1e-9) return "4:1";
  return null;
}

export function normalizedSampleRatioParts(resinParts, hardenerParts) {
  const ratio = normalizeSupportedSampleRatio(resinParts, hardenerParts);
  if (!ratio) return null;
  const [resin, hardener] = ratio.split(":");
  return { ratio, resinParts: resin, hardenerParts: hardener };
}
