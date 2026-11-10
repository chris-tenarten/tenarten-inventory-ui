export type SupportedSampleRatio = "5:1" | "4:1";
export function normalizeSupportedSampleRatio(resinParts: unknown, hardenerParts: unknown): SupportedSampleRatio | null;
export function normalizedSampleRatioParts(resinParts: unknown, hardenerParts: unknown): { ratio: SupportedSampleRatio; resinParts: string; hardenerParts: string } | null;
