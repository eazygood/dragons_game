import type { StrategyName } from '@bigbank-dragon/contracts';

export type BotStrategy = Exclude<StrategyName, 'manual'>;

export type BotRunResult = { gameId: string; score: number; turns: number; strategy: BotStrategy };
