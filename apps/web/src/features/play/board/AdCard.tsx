import type { AdvisedAd } from '@bigbank-dragon/contracts';
import { useId } from 'react';

import type { MoveActions } from '../move-actions/move-actions.ts';
import { playCopy } from '../play-copy.ts';
import { AdviceBadge } from './AdviceBadge.tsx';
import styles from './AdCard.module.css';

export const AdCard = ({ ad, moveActions }: { ad: AdvisedAd; moveActions: MoveActions }) => {
  const reasonId = useId();
  const isUnattemptable = ad.advice.verdict === 'unattemptable';

  return (
    <article className={styles.card} data-verdict={ad.advice.verdict}>
      <p className={styles.message}>{ad.message}</p>
      <p className={styles.meta}>
        <span>
          {playCopy.board.reward}: {ad.reward}
        </span>
        <span>
          {playCopy.board.probabilityLabel}: {ad.probability}
        </span>
        <span>{playCopy.board.expiresIn(ad.expiresIn)}</span>
        {ad.wasEncrypted && <span className={styles.tag}>{playCopy.board.decodedTag}</span>}
      </p>
      <AdviceBadge advice={ad.advice} />
      {isUnattemptable && (
        <p id={reasonId} className={styles.reason}>
          {playCopy.board.unattemptableReason}
        </p>
      )}
      <button
        type="button"
        aria-label={playCopy.board.solveLabel(ad.message)}
        aria-describedby={isUnattemptable ? reasonId : undefined}
        disabled={isUnattemptable || moveActions.isPending}
        onClick={() => moveActions.solve(ad.adId)}
      >
        {playCopy.board.solve}
      </button>
    </article>
  );
};
