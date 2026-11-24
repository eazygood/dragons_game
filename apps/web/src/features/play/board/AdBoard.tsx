import type { AdvisedAd } from '@bigbank-dragon/contracts';
import { useId } from 'react';

import { copy } from '../copy.ts';
import type { MoveControls } from '../moves/move-controls.ts';
import { AdCard } from './AdCard.tsx';
import styles from './AdBoard.module.css';

export const AdBoard = ({ board, moves }: { board: AdvisedAd[]; moves: MoveControls }) => {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>{copy.board.title}</h2>
      <ul className={styles.list}>
        {board.map((ad) => (
          <li key={ad.adId}>
            <AdCard ad={ad} moves={moves} />
          </li>
        ))}
      </ul>
    </section>
  );
};
