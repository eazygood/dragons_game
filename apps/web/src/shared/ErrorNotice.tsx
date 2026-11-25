import styles from './ErrorNotice.module.css';
import { errorCopy } from './error-copy.ts';
import { sharedCopy } from './shared-copy.ts';

export const ErrorNotice = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div role="alert" className={styles.notice}>
    <p>{errorCopy({ error })}</p>
    <button type="button" onClick={onRetry}>
      {sharedCopy.errors.retry}
    </button>
  </div>
);
