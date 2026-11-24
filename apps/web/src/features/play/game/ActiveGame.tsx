import type { TurnView } from '@bigbank-dragon/contracts';

import { RecommendationBanner } from '../advice/RecommendationBanner.tsx';
import { AdBoard } from '../board/AdBoard.tsx';
import type { MoveControls } from '../moves/move-controls.ts';
import { GameStatusBar } from './GameStatusBar.tsx';
import styles from './ActiveGame.module.css';

// Replaced by real moves in the next task; until then nothing on the board is clickable.
const DISABLED_MOVES: MoveControls = {
  solve: () => undefined,
  buy: () => undefined,
  isPending: true,
};

export const ActiveGame = ({ turn }: { turn: TurnView }) => (
  <div className={styles.game}>
    <GameStatusBar state={turn.game.state} />
    <RecommendationBanner turn={turn} />
    <div className={styles.columns}>
      <AdBoard board={turn.board} moves={DISABLED_MOVES} />
    </div>
  </div>
);
