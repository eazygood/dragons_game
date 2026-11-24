import { copy } from '../copy.ts';
import { errorCopy } from '../error-copy.ts';
import styles from './ErrorNotice.module.css';

export const ErrorNotice = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div role="alert" className={styles.notice}>
    <p>{errorCopy({ error })}</p>
    <button type="button" onClick={onRetry}>
      {copy.errors.retry}
    </button>
  </div>
);
