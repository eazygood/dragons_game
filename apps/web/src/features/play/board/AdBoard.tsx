import type { AdvisedAd } from '@dragons-game/contracts';
import { useId } from 'react';

import type { MoveActions } from '../move-actions/move-actions.ts';
import { playCopy } from '../play-copy.ts';
import { AdCard } from './AdCard.tsx';
import styles from './AdBoard.module.css';

export const AdBoard = ({
  board,
  moveActions,
}: {
  board: AdvisedAd[];
  moveActions: MoveActions;
}) => {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>{playCopy.board.title}</h2>
      {board.length === 0 ? (
        <p>{playCopy.board.empty}</p>
      ) : (
        <ul className={styles.list}>
          {board.map((ad) => (
            <li key={ad.adId}>
              <AdCard ad={ad} moveActions={moveActions} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
