import type { GameView } from '@bigbank-dragon/contracts';
import { Link } from '@tanstack/react-router';

import { RunBotAgainButton } from './RunBotAgainButton.tsx';
import styles from './WatchScreen.module.css';
import { watchCopy } from './watch-copy.ts';
import { watchOutcome } from './watch-outcome.ts';
import type { WatchOutcomeKind } from './watch-outcome.ts';

const statusText = ({ outcome, score }: { outcome: WatchOutcomeKind; score: number }) => {
  if (outcome === 'in_progress') {
    return watchCopy.inProgress;
  }

  return outcome === 'reached_target'
    ? watchCopy.reachedTarget(score)
    : watchCopy.finishedBelowTarget(score);
};

export const WatchOutcome = ({ game }: { game: GameView }) => {
  const outcome = watchOutcome({ game });

  return (
    <section className={styles.outcome}>
      <p role="status" className={outcome === 'reached_target' ? styles.reached : undefined}>
        {statusText({ outcome, score: game.state.score })}
      </p>
      <p className={styles.target}>{watchCopy.target}</p>
      {outcome !== 'in_progress' && (
        <div className={styles.links}>
          <Link to="/play">{watchCopy.playYourself}</Link>
          <RunBotAgainButton />
        </div>
      )}
    </section>
  );
};
