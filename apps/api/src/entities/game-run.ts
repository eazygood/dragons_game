import type { RunStatus } from '@dragons-game/contracts';
import { z } from 'zod';

export { RUN_STATUSES } from '@dragons-game/contracts';
export type { RunStatus } from '@dragons-game/contracts';

const STRATEGY_NAMES = ['manual', 'baseline', 'calibrated'] as const;

export const StrategyNameSchema = z.enum(STRATEGY_NAMES);

export type StrategyName = (typeof STRATEGY_NAMES)[number];

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
