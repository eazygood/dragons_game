import type { TurnView } from '@bigbank-dragon/contracts';

import { RecommendationBanner } from '../advice/RecommendationBanner.tsx';
import { AdBoard } from '../board/AdBoard.tsx';
import { MoveFeedback } from '../moves/MoveFeedback.tsx';
import { usePlayerMoves } from '../moves/use-player-moves.ts';
import { ShopPanel } from '../shop/ShopPanel.tsx';
import { GameStatusBar } from './GameStatusBar.tsx';
import styles from './ActiveGame.module.css';

export const ActiveGame = ({ turn }: { turn: TurnView }) => {
  const { state } = turn.game;
  const { lastMove, notice, ...moves } = usePlayerMoves({ gameId: state.gameId });

  return (
    <div className={styles.game}>
      <GameStatusBar state={state} />
      <RecommendationBanner turn={turn} />
      <MoveFeedback lastMove={lastMove} notice={notice} />
      <div className={styles.columns}>
        <AdBoard board={turn.board} moves={moves} />
        <ShopPanel shop={turn.shop} gold={state.gold} moves={moves} />
      </div>
    </div>
  );
};
