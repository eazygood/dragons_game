import type { MoveResult } from '@bigbank-dragon/contracts';

import { copy } from '../copy.ts';
import type { MoveNotice } from './use-player-moves.ts';
import styles from './MoveFeedback.module.css';

const NOTICE_COPY: Record<MoveNotice, string> = {
  ad_expired: copy.moves.adExpired,
  purchase_refused: copy.moves.purchaseRefused,
  upstream_down: copy.errors.upstreamUnavailable,
  unexpected: copy.errors.unexpected,
};

const describeMove = ({ lastMove }: { lastMove: MoveResult }) => {
  const outcome = lastMove.success ? copy.moves.succeeded : copy.moves.failed;

  return lastMove.message ? `${outcome} ${lastMove.message}` : outcome;
};

// The live region is always mounted so screen readers announce each change to it.
export const MoveFeedback = ({
  lastMove,
  notice,
}: {
  lastMove: MoveResult | null;
  notice: MoveNotice | null;
}) => {
  const text = notice ? NOTICE_COPY[notice] : lastMove && describeMove({ lastMove });
  const tone = notice ? 'notice' : lastMove?.success ? 'success' : 'failure';

  return (
    <p role="status" aria-live="polite" className={styles.feedback} data-tone={tone}>
      {text}
    </p>
  );
};
