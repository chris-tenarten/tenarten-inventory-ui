import { isCuratedDemoBid } from './curated-demo';
import styles from './CuratedDemoBadge.module.css';

export default function CuratedDemoBadge({ bidId }: { bidId: string }) {
  if (!isCuratedDemoBid(bidId)) return null;
  return <span title="Shared demo Bid — example data" className={`tenops-compact-type shrink-0 rounded-full border px-2 py-0.5 font-bold uppercase tracking-[0.12em] ${styles.badge}`}>TEST</span>;
}
