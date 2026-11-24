import type { AdvisedAd } from '@bigbank-dragon/contracts';

import { copy } from '../copy.ts';
import type { MoveControls } from '../moves/move-controls.ts';
import { AdviceBadge } from './AdviceBadge.tsx';
import styles from './AdCard.module.css';

export const AdCard = ({ ad, moves }: { ad: AdvisedAd; moves: MoveControls }) => {
  const { verdict } = ad.advice;
  const isUnattemptable = verdict === 'unattemptable';

  return (
    <article
      className={styles.card}
      data-verdict={verdict}
      aria-label={`${copy.board.verdict[verdict]}: ${ad.message}`}
    >
      <p className={styles.message}>{ad.message}</p>
      <p className={styles.meta}>
        <span>
          {copy.board.reward}: {ad.reward}
        </span>
        <span>{ad.probability}</span>
        <span>{copy.board.expiresIn(ad.expiresIn)}</span>
        {ad.wasEncrypted && <span className={styles.tag}>{copy.board.decodedTag}</span>}
      </p>
      <AdviceBadge advice={ad.advice} />
      {isUnattemptable && <p className={styles.reason}>{copy.board.unattemptableReason}</p>}
      <button
        type="button"
        aria-label={copy.board.solveLabel(ad.message)}
        disabled={isUnattemptable || moves.isPending}
        onClick={() => moves.solve(ad.adId)}
      >
        {copy.board.solve}
      </button>
    </article>
  );
};
