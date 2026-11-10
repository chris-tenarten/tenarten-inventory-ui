export const isEarlyAccessEnabled = (value) => value === "true";

export const EARLY_ACCESS_ENABLED = isEarlyAccessEnabled(
  process.env.NEXT_PUBLIC_EARLY_ACCESS,
);
