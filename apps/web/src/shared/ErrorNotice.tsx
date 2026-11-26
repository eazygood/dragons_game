import styles from './ErrorNotice.module.css';
import { errorCopy } from './error-copy.ts';
import { sharedCopy } from './shared-copy.ts';

type ErrorNoticeProps = {
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
};

export const ErrorNotice = ({ error, onRetry, isRetrying = false }: ErrorNoticeProps) => (
  <div role="alert" className={styles.notice}>
    <p>{errorCopy({ error })}</p>
    <button type="button" onClick={onRetry} disabled={isRetrying}>
      {isRetrying ? sharedCopy.errors.retrying : sharedCopy.errors.retry}
    </button>
  </div>
);
