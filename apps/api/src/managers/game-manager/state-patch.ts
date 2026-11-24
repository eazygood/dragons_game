import type { GameState } from '@bigbank-dragon/contracts';

import type { GameRun, GameRunPatch } from '../../entities/game-run.ts';

export const statePatch = ({ state }: { state: GameState }): GameRunPatch => ({
  lives: state.lives,
  gold: state.gold,
  dragonLevel: state.dragonLevel,
  turn: state.turn,
  score: state.score,
});

export const stateFromRun = ({ run }: { run: GameRun }): GameState => ({
  gameId: run.gameId,
  lives: run.lives,
  gold: run.gold,
  dragonLevel: run.dragonLevel,
  turn: run.turn,
  score: run.score,
});
