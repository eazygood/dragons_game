import type { RunStatus, StrategyName } from '@bigbank-dragon/contracts';

export { RUN_STATUSES } from '@bigbank-dragon/contracts';
export type { RunStatus } from '@bigbank-dragon/contracts';

export type GameRunId = number;

export interface GameRun {
  id: GameRunId;
  gameId: string;
  strategy: StrategyName;
  benchmarkId: string | null;
  lives: number;
  gold: number;
  dragonLevel: number;
  turn: number;
  score: number;
  status: RunStatus;
  startedAt: Date;
  endedAt: Date | null;
}

export type NewGameRun = Omit<GameRun, 'id'>;

export type GameRunPatch = Partial<
  Pick<GameRun, 'lives' | 'gold' | 'dragonLevel' | 'turn' | 'score' | 'status' | 'endedAt'>
>;
