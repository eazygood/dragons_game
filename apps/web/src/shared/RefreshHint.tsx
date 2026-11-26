import styles from './RefreshHint.module.css';
import { sharedCopy } from './shared-copy.ts';

// The live region stays mounted while empty: a region inserted together with its text is not announced.
export const RefreshHint = ({ hasFailed }: { hasFailed: boolean }) => (
  <div role="status">
    {hasFailed && <p className={styles.hint}>{sharedCopy.errors.refreshFailed}</p>}
  </div>
);
