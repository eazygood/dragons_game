import type { MoveResult } from '@bigbank-dragon/contracts';

import { playCopy } from '../play-copy.ts';
import type { FeedbackRef, MoveReport } from './move-actions.ts';
import styles from './MoveFeedback.module.css';

type FeedbackTone = 'success' | 'failure' | 'notice' | 'idle';

const describeMoveResult = ({ result }: { result: MoveResult }) => {
  const resultLabel = result.success ? playCopy.moves.succeeded : playCopy.moves.failed;

  return result.message ? `${resultLabel} ${result.message}` : resultLabel;
};

const feedbackFor = ({
  lastResult,
  notice,
}: MoveReport): { text: string | null; tone: FeedbackTone } => {
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
