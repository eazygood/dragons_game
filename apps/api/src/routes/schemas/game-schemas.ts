import { GameIdSchema, IdentifierSchema } from '@dragons-game/contracts';
import { z } from 'zod';

const AdIdSchema = IdentifierSchema;
const ItemIdSchema = IdentifierSchema;

export const GameParamsSchema = z.object({ gameId: GameIdSchema });
export const SolveParamsSchema = z.object({ gameId: GameIdSchema, adId: AdIdSchema });
export const BuyParamsSchema = z.object({ gameId: GameIdSchema, itemId: ItemIdSchema });

export type GameParams = z.infer<typeof GameParamsSchema>;
export type SolveParams = z.infer<typeof SolveParamsSchema>;
export type BuyParams = z.infer<typeof BuyParamsSchema>;
