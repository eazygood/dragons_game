import type { MoveResult } from '@bigbank-dragon/contracts';

import { playCopy } from '../play-copy.ts';
import type { FeedbackRef, MoveOutcome } from './move-actions.ts';
import styles from './MoveFeedback.module.css';

type FeedbackTone = 'success' | 'failure' | 'notice' | 'idle';

const describeMoveResult = ({ result }: { result: MoveResult }) => {
  const outcome = result.success ? playCopy.moves.succeeded : playCopy.moves.failed;

  return result.message ? `${outcome} ${result.message}` : outcome;
};

const feedbackFor = ({
  lastResult,
  notice,
}: MoveOutcome): { text: string | null; tone: FeedbackTone } => {
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

// The live region is always mounted so screen readers announce each change to it.
export const MoveFeedback = ({
  outcome,
  feedbackRef,
}: {
  outcome: MoveOutcome;
  feedbackRef: FeedbackRef;
}) => {
  const { text, tone } = feedbackFor(outcome);

  return (
    <p ref={feedbackRef} tabIndex={-1} role="status" className={styles.feedback} data-tone={tone}>
      {text}
    </p>
  );
};
