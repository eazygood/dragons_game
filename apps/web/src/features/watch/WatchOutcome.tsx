import type { GameView } from '@dragons-game/contracts';
import { Link } from '@tanstack/react-router';

import { Panel } from '../../shared/Panel.tsx';
import { RunBotAgainButton } from './RunBotAgainButton.tsx';
import styles from './WatchOutcome.module.css';
import { watchCopy } from './watch-copy.ts';
import { watchOutcome } from './watch-outcome.ts';
import type { WatchOutcomeKind } from './watch-outcome.ts';

const statusText = ({ outcomeKind, score }: { outcomeKind: WatchOutcomeKind; score: number }) => {
  if (outcomeKind === 'in_progress') {
    return watchCopy.inProgress;
  }

  return outcomeKind === 'reached_target'
    ? watchCopy.reachedTarget(score)
    : watchCopy.finishedBelowTarget(score);
};

export const WatchOutcome = ({ game }: { game: GameView }) => {
  const outcomeKind = watchOutcome({ game });

  return (
    <Panel>
      <p role="status" className={outcomeKind === 'reached_target' ? styles.reached : undefined}>
        {statusText({ outcomeKind, score: game.state.score })}
      </p>
      <p className={styles.target}>{watchCopy.target}</p>
      {outcomeKind !== 'in_progress' && (
        <div className={styles.links}>
          <Link to="/play">{watchCopy.playYourself}</Link>
          <RunBotAgainButton />
        </div>
      )}
    </Panel>
  );
};
