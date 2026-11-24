import { z } from 'zod';

export const STRATEGY_NAMES = ['manual', 'baseline', 'calibrated'] as const;

export const StrategyNameSchema = z.enum(STRATEGY_NAMES);

export type StrategyName = (typeof STRATEGY_NAMES)[number];

export const RUN_STATUSES = ['active', 'game_over', 'abandoned'] as const;

export const RunStatusSchema = z.enum(RUN_STATUSES);

export type RunStatus = (typeof RUN_STATUSES)[number];

export const GameStateSchema = z.object({
  gameId: z.string().min(1),
  lives: z.number().int(),
  gold: z.number().int(),
  dragonLevel: z.number().int(),
  turn: z.number().int(),
  score: z.number().int(),
});

export type GameState = z.infer<typeof GameStateSchema>;

export const GameSnapshotSchema = z.object({
  gameId: z.string().min(1),
  lives: z.number().int(),
  gold: z.number().int(),
  level: z.number().int(),
  score: z.number().int(),
  highScore: z.number().int(),
  turn: z.number().int(),
});

export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;
