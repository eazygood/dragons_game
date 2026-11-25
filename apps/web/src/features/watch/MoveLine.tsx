import type { Move } from '@bigbank-dragon/contracts';

import { formatGold, formatPercent } from '../play/format.ts';
import styles from './MoveLog.module.css';
import { watchCopy } from './watch-copy.ts';

const describeAction = ({ move }: { move: Move }) => {
  if (move.kind === 'solve') {
    return watchCopy.move.solved({ probability: move.probability, reward: move.reward });
  }

  return move.itemName === null
    ? watchCopy.move.boughtUnnamedItem
    : watchCopy.move.bought({ itemName: move.itemName });
};

const describeReason = ({ move }: { move: Move }) => {
  if (move.rule === null) {
    return null;
  }

  const ruleCopy = watchCopy.rules[move.rule];

  if (move.kind === 'buy') {
    return ruleCopy;
  }

  return watchCopy.move.solveReason({
    rule: ruleCopy,
    percent: formatPercent({ probability: move.estimatedProbability }),
    gold: formatGold({ gold: move.expectedValue }),
  });
};

const describeMove = ({ move }: { move: Move }) =>
  [watchCopy.move.turn({ turn: move.turn }), describeAction({ move }), describeReason({ move })]
    .filter((part) => part !== null)
    .join(watchCopy.move.separator);

export const MoveLine = ({ move }: { move: Move }) => {
  const resultMark = move.success ? watchCopy.move.succeeded : watchCopy.move.failed;

  return (
    <li className={styles.line}>
      {describeMove({ move })}
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
