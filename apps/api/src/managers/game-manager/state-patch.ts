import type { GameState } from '@bigbank-dragon/contracts';

import type { GameRunPatch } from '../../entities/game-run.ts';

export const statePatch = ({ state }: { state: GameState }): GameRunPatch => ({
  lives: state.lives,
  gold: state.gold,
  dragonLevel: state.dragonLevel,
  turn: state.turn,
  score: state.score,
});
