import type { Move } from '@bigbank-dragon/contracts';

import { formatChance, formatGold } from '../../shared/format.ts';
import styles from './MoveLine.module.css';
import { watchCopy } from './watch-copy.ts';

// A failed move is an attempt: the ✗ mark alone cannot undo a verb that says it happened.
const describeLoggedAction = ({ move }: { move: Move }) => {
  if (move.kind === 'solve') {
    const describeSolve = move.success ? watchCopy.move.solved : watchCopy.move.solveAttempted;

    return describeSolve({ adRating: move.probability, reward: move.reward });
  }

  if (move.itemName === null) {
    return move.success ? watchCopy.move.boughtUnnamedItem : watchCopy.move.buyAttemptedUnnamedItem;
  }

  const describeBuy = move.success ? watchCopy.move.bought : watchCopy.move.buyAttempted;

  return describeBuy({ itemName: move.itemName });
};

const describeLoggedReason = ({ move }: { move: Move }) => {
  if (move.rule === null) {
    return null;
  }

  const ruleCopy = watchCopy.rules[move.rule];

  if (move.kind === 'buy') {
    return ruleCopy;
  }

  return watchCopy.move.solveReason({
    rule: ruleCopy,
    percent: formatChance({ winChance: move.estimatedProbability }),
    gold: formatGold({ gold: move.expectedValue }),
  });
};

const describeLoggedMove = ({ move }: { move: Move }) =>
  [
    watchCopy.move.turn({ turn: move.turn }),
    describeLoggedAction({ move }),
    describeLoggedReason({ move }),
  ]
    .filter((part) => part !== null)
    .join(watchCopy.move.separator);

export const MoveLine = ({ move }: { move: Move }) => {
  const resultMark = move.success ? watchCopy.move.succeeded : watchCopy.move.failed;

  return (
    <li className={styles.line}>
      {describeLoggedMove({ move })}
      {watchCopy.move.separator}
      <span
        role="img"
        aria-label={resultMark.label}
        className={move.success ? styles.succeeded : styles.failed}
      >
        {resultMark.mark}
      </span>
    </li>
  );
};
