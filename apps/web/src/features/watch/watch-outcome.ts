import { TARGET_SCORE } from '@bigbank-dragon/contracts';
import type { GameView } from '@bigbank-dragon/contracts';

export type WatchOutcomeKind = 'in_progress' | 'reached_target' | 'finished_below_target';

// An abandoned run (the engine stopped) and a game over are both just "finished".
export const watchOutcome = ({ game }: { game: GameView }): WatchOutcomeKind => {
  if (game.status === 'active') {
    return 'in_progress';
  }

  return game.state.score >= TARGET_SCORE ? 'reached_target' : 'finished_below_target';
};
