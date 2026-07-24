import { productionStatusVisualByValue } from '../status-visuals';
import type { ProductionStatus } from '../types';
import { useLanguage } from '@/lib/language';

export default function ProductionStatusBadge({ status }: { status: ProductionStatus }) {
  const { language } = useLanguage();
  const visual = productionStatusVisualByValue[status];
  const spanishLabels: Record<ProductionStatus, string> = {
    not_started: 'No iniciado',
    on_deck: 'Próximo',
    in_production: 'En producción',
    on_hold: 'En pausa',
    shipped: 'Enviado',
    complete: 'Terminado',
    cancelled: 'Cancelado',
  };
  return <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] shadow-sm ${visual.className}`} style={visual.pattern ? { backgroundImage: visual.pattern } : undefined}>{language === 'es' ? spanishLabels[status] : visual.label}</span>;
}
