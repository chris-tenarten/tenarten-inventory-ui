type EarlyAccessBadgeProps = {
  className?: string;
  title?: string;
};

export default function EarlyAccessBadge({ className = "", title }: EarlyAccessBadgeProps) {
  return (
    <span
      title={title}
      className={`shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800 ${className}`}
    >
      Early Access
    </span>
  );
}
