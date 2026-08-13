import { AlertTriangle } from 'lucide-react';

type Props = {
  onClick?: () => void;
  compact?: boolean;
};

export default function UnscheduledBadge({ onClick, compact = false }: Props) {
  const content = <><AlertTriangle aria-hidden="true" className="h-3 w-3" /><span>Unscheduled</span></>;
  const className = `inline-flex items-center gap-1 border border-amber-400 bg-amber-50 font-bold text-amber-900 ${compact ? 'h-5 px-1.5 text-[9px]' : 'h-6 px-2 text-[10px]'}`;
  return onClick ? <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} className={`${className} pointer-events-auto hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600`} aria-label="Open Timeline to schedule this job" title="Open Timeline to schedule this job">{content}</button> : <span className={className}>{content}</span>;
}
