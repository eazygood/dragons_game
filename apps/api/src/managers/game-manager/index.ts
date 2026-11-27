// What callers outside this folder may use. The other exports in the folder are only for
// sharing between its own files.
export { findAds, findShopItems } from './board-and-shop.ts';
export { withGameLock } from './game-lock.ts';
export {
  findBenchmarkRuns,
  findPlayableRun,
  findRun,
  finishRun,
  recordGameOver,
  startGameRun,
} from './game-runs.ts';
export { isOutOfLives, stateFromRun, toGameView } from './game-state.ts';
export { findMoveHistory } from './move-history.ts';
export { playBuyTurn, playSolveTurn } from './play-turn.ts';
export type { MoveContext } from './play-turn.ts';
export { buyPlayerItem, solvePlayerAd } from './player-moves.ts';
export type { PlayerMove } from './player-moves.ts';
export { saveStateWithRecord } from './turn-persistence.ts';
export type { OnPersistFailure, SavedTurn, TurnResult } from './turn-persistence.ts';
