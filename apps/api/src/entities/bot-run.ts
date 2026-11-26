import { StrategyNameSchema } from '@bigbank-dragon/contracts';
import type { z } from 'zod';

// The one declaration of the strategies a bot can play; the CLIs parse their arguments with it.
export const BotStrategySchema = StrategyNameSchema.exclude(['manual']);

export type BotStrategy = z.infer<typeof BotStrategySchema>;

export type BotRunResult = { gameId: string; score: number; turns: number; strategy: BotStrategy };
