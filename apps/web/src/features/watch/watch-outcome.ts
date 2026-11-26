import { TARGET_SCORE } from '@dragons-game/contracts';
import type { GameView } from '@dragons-game/contracts';

import { hasActiveStatus } from '../../api/game-status.ts';

export type WatchOutcomeKind = 'in_progress' | 'reached_target' | 'finished_below_target';

// An abandoned run (the engine stopped) and a game over are both just "finished".
export const watchOutcome = ({ game }: { game: GameView }): WatchOutcomeKind => {
  if (hasActiveStatus({ game })) {
    return 'in_progress';
  }

  return game.state.score >= TARGET_SCORE ? 'reached_target' : 'finished_below_target';
};
