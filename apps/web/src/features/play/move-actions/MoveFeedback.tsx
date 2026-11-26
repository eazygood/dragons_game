import type { MoveResult } from '@dragons-game/contracts';

import { playCopy } from '../play-copy.ts';
import type { FeedbackRef, MoveReport } from './move-actions.ts';
import styles from './MoveFeedback.module.css';

type FeedbackTone = 'pending' | 'success' | 'failure' | 'notice' | 'idle';

const describeMoveResult = ({ result }: { result: MoveResult }) => {
  const resultLabel = result.success ? playCopy.moves.succeeded : playCopy.moves.failed;

  return result.message ? `${resultLabel} ${result.message}` : resultLabel;
};

const feedbackFor = ({
  pendingKind,
  lastResult,
  notice,
}: MoveReport): { text: string | null; tone: FeedbackTone } => {
  // The lock lasts until the board is refetched, so the wait can outlast the move itself.
  if (pendingKind !== null) {
    return { text: playCopy.moves.pending[pendingKind], tone: 'pending' };
  }

  if (notice !== null) {
    return { text: notice, tone: 'notice' };
  }

  if (lastResult === null) {
    return { text: null, tone: 'idle' };
  }

  return {
    text: describeMoveResult({ result: lastResult }),
    tone: lastResult.success ? 'success' : 'failure',
  };
};

// The live region is always mounted so screen readers announce each change to it. It is
// named because the refresh hint is a second status region on the same screen.
export const MoveFeedback = ({
  report,
  feedbackRef,
}: {
  report: MoveReport;
  feedbackRef: FeedbackRef;
}) => {
  const { text, tone } = feedbackFor(report);

  return (
    <p
      ref={feedbackRef}
      tabIndex={-1}
      role="status"
      aria-label={playCopy.moves.label}
      className={styles.feedback}
      data-tone={tone}
    >
      {text}
    </p>
  );
};
