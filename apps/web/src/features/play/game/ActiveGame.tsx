import type { GameView, TurnView } from '@bigbank-dragon/contracts';

import { GameStatusBar } from '../../../shared/GameStatusBar.tsx';
import { sharedCopy } from '../../../shared/shared-copy.ts';
import { RecommendationBanner } from '../advice/RecommendationBanner.tsx';
import { AdBoard } from '../board/AdBoard.tsx';
import { MoveFeedback } from '../move-actions/MoveFeedback.tsx';
import { useMoveActions } from '../move-actions/use-move-actions.ts';
import { ShopPanel } from '../shop/ShopPanel.tsx';
import styles from './ActiveGame.module.css';

type ActiveGameProps = {
  game: GameView;
  turnView: TurnView;
  hasRefreshFailed: boolean;
};

export const ActiveGame = ({ game, turnView, hasRefreshFailed }: ActiveGameProps) => {
  const { state } = game;
  const { moveActions, moveOutcome, feedbackRef } = useMoveActions({ gameId: state.gameId });

  return (
    <div className={styles.game}>
      <GameStatusBar state={state} />
      {hasRefreshFailed && <p role="status">{sharedCopy.errors.refreshFailed}</p>}
      <RecommendationBanner turnView={turnView} />
      <MoveFeedback outcome={moveOutcome} feedbackRef={feedbackRef} />
      <div className={styles.columns}>
        <AdBoard board={turnView.board} moveActions={moveActions} />
        <ShopPanel shop={turnView.shop} gold={state.gold} moveActions={moveActions} />
      </div>
    </div>
  );
};
