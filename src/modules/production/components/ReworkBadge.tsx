export default function ReworkBadge({ sequence, showSequence = true }: { sequence: number; showSequence?: boolean }) {
  return <span className="inline-flex h-5 items-center rounded-sm border border-violet-300 bg-violet-50 px-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-violet-900">{showSequence ? `Rework #${sequence}` : "Rework"}</span>;
}
