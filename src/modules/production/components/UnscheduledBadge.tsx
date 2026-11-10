import { AlertTriangle } from 'lucide-react';
import { productionTagClassName } from './production-tag';

type Props = {
  onClick?: () => void;
  iconOnly?: boolean;
  ariaLabel?: string;
};

export default function UnscheduledBadge({ onClick, iconOnly = false, ariaLabel }: Props) {
  if (iconOnly) {
    return <button type="button" onClick={(event) => { event.stopPropagation(); onClick?.(); }} className="inline-flex h-6 w-5 shrink-0 items-center justify-center text-amber-700 hover:bg-amber-50 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" aria-label={ariaLabel ?? "Needs planned dates"} title="Needs planned dates"><AlertTriangle aria-hidden="true" className="h-3 w-3" /></button>;
  }
  const className = `${productionTagClassName} whitespace-nowrap border-amber-600 bg-amber-200 uppercase tracking-[0.06em] text-amber-950`;
  return onClick ? <button data-needs-dates-tag type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} className={`${className} pointer-events-auto hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600`} aria-label={ariaLabel ?? "Open Timeline to schedule this job"} title="Open Timeline to schedule this job">Needs dates</button> : <span data-needs-dates-tag className={className}>Needs dates</span>;
}
