import { productionTagClassName } from "./production-tag";

export default function ReworkBadge({ sequence, showSequence = true }: { sequence: number; showSequence?: boolean }) {
  return <span className={`${productionTagClassName} whitespace-nowrap border-violet-300 bg-violet-50 uppercase tracking-[0.08em] text-violet-900`}>{showSequence ? `Rework #${sequence}` : "Rework"}</span>;
}
