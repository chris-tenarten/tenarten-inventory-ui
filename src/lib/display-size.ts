export const DISPLAY_SIZE_STORAGE_KEY = "tenops_display_size";

export const DISPLAY_SIZES = ["compact", "default", "large"] as const;

export type DisplaySize = (typeof DISPLAY_SIZES)[number];

export const DISPLAY_SIZE_OPTIONS: Array<{
  value: DisplaySize;
  label: string;
  description: string;
}> = [
  {
    value: "compact",
    label: "Compact",
    description: "More information on screen with tighter controls and rows.",
  },
  {
    value: "default",
    label: "Default",
    description: "The standard TenOps text size and interface density.",
  },
  {
    value: "large",
    label: "Large",
    description: "Larger text, controls, and spacing for easier reading.",
  },
];

export function isDisplaySize(value: unknown): value is DisplaySize {
  return DISPLAY_SIZES.includes(value as DisplaySize);
}

export function readDisplaySize(): DisplaySize {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem(DISPLAY_SIZE_STORAGE_KEY);
  return isDisplaySize(stored) ? stored : "default";
}

export function applyDisplaySize(value: DisplaySize) {
  document.documentElement.dataset.displaySize = value;
}

export function saveDisplaySize(value: DisplaySize) {
  window.localStorage.setItem(DISPLAY_SIZE_STORAGE_KEY, value);
  applyDisplaySize(value);
  window.dispatchEvent(
    new CustomEvent("tenops-display-size-change", { detail: value }),
  );
}
