import type { StrategyName } from '@bigbank-dragon/contracts';

export const RUN_STATUSES = ['active', 'game_over', 'abandoned'] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

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
