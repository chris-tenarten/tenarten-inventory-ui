import { productionStatusVisualByValue } from '../status-visuals';
import type { ProductionStatus } from '../types';

export default function ProductionStatusBadge({ status }: { status: ProductionStatus }) {
  const visual = productionStatusVisualByValue[status];
  return <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] shadow-sm ${visual.className}`} style={visual.pattern ? { backgroundImage: visual.pattern } : undefined}>{visual.label}</span>;
}
