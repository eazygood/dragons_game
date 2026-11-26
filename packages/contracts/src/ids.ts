import { z } from 'zod';

// Decoded upstream ids are short alphanumerics; the maximum matches the DB columns. `=`,
// `/` and `+` are refused because the client only ever sees decoded ids.
export const IDENTIFIER_MAX_LENGTH = 64;

const IDENTIFIER_PATTERN = new RegExp(`^[A-Za-z0-9_-]{1,${IDENTIFIER_MAX_LENGTH}}$`);

export const IdentifierSchema = z.string().regex(IDENTIFIER_PATTERN, 'Invalid identifier');

export const GameIdSchema = IdentifierSchema;
const AdIdSchema = IdentifierSchema;
const ItemIdSchema = IdentifierSchema;

export const GameParamsSchema = z.object({ gameId: GameIdSchema });
export const SolveParamsSchema = z.object({ gameId: GameIdSchema, adId: AdIdSchema });
export const BuyParamsSchema = z.object({ gameId: GameIdSchema, itemId: ItemIdSchema });

export type GameParams = z.infer<typeof GameParamsSchema>;
export type SolveParams = z.infer<typeof SolveParamsSchema>;
export type BuyParams = z.infer<typeof BuyParamsSchema>;
