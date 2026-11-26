import type { GameView, TurnView } from '@dragons-game/contracts';

import { GameStatusBar } from '../../../shared/GameStatusBar.tsx';
import { focusOnMount } from '../../../shared/focus-on-mount.ts';
import { RecommendationBanner } from '../advice/RecommendationBanner.tsx';
import { AdBoard } from '../board/AdBoard.tsx';
import { MoveFeedback } from '../move-actions/MoveFeedback.tsx';
import { useMoveActions } from '../move-actions/use-move-actions.ts';
import { playCopy } from '../play-copy.ts';
import { ShopPanel } from '../shop/ShopPanel.tsx';
import styles from './ActiveGame.module.css';

type ActiveGameProps = {
  game: GameView;
  turnView: TurnView;
  hasRefreshFailed: boolean;
};

export const ActiveGame = ({ game, turnView, hasRefreshFailed }: ActiveGameProps) => {
  const gameState = game.state;
  const { moveActions, moveReport, feedbackRef } = useMoveActions({ gameId: gameState.gameId });

  return (
    <div className={styles.game}>
      <h2 ref={focusOnMount} tabIndex={-1} className={styles.title}>
        {playCopy.game.title}
      </h2>
      <GameStatusBar state={gameState} hasRefreshFailed={hasRefreshFailed} />
      <RecommendationBanner turnView={turnView} />
      <MoveFeedback report={moveReport} feedbackRef={feedbackRef} />
      <div className={styles.columns}>
        <AdBoard board={turnView.board} moveActions={moveActions} />
        <ShopPanel shop={turnView.shop} gold={gameState.gold} moveActions={moveActions} />
      </div>
    </div>
  );
};
