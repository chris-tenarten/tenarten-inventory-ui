import styles from './UnderDevelopmentBadge.module.css';

/** Module maturity only; never a record status or an authorization indicator. */
export default function UnderDevelopmentBadge() {
  return <span className={`tenops-compact-type ${styles.badge}`}>Under Development</span>;
}
