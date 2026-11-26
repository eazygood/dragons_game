import type { GameState } from '@dragons-game/contracts';

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

// A move that takes the last life still returns 200 upstream; the next call would be a 410.
export const isOutOfLives = ({ state }: { state: GameState }): boolean => state.lives <= 0;
