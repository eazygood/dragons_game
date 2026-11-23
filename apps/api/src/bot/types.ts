import type { StrategyName } from '@bigbank-dragon/contracts';

import type { Logger } from '../config/logger.ts';

export type BotStrategy = Exclude<StrategyName, 'manual'>;

export type BotLogger = Logger;

export type BotRunResult = { gameId: string; score: number; turns: number; strategy: BotStrategy };
