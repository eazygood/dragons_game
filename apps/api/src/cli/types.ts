import { StrategyNameSchema } from '@bigbank-dragon/contracts';

export type { BotRunResult, BotStrategy } from '../entities/bot-run.ts';

export const BotStrategySchema = StrategyNameSchema.exclude(['manual']);
