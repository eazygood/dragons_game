import type { StrategyName } from '@bigbank-dragon/contracts';

export type BotStrategy = Exclude<StrategyName, 'manual'>;

// Pino's argument order, so the Fastify logger can be passed straight in.
export type BotLogger = {
  info(details: object, message: string): void;
  warn(details: object, message: string): void;
};

export type BotRunResult = { gameId: string; score: number; turns: number; strategy: BotStrategy };
