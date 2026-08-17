import { productionStatusVisualByValue } from '../status-visuals';
import type { ProductionStatus } from '../types';
import { useLanguage } from '@/lib/language';
import { productionTagClassName } from './production-tag';

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
  return <span className={`${productionTagClassName} uppercase tracking-[0.06em] ${visual.className}`} style={visual.pattern ? { backgroundImage: visual.pattern } : undefined}>{language === 'es' ? spanishLabels[status] : visual.label}</span>;
}
