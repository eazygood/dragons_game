import { z } from 'zod';

// Decoded upstream ids are short alphanumerics; 64 matches the DB columns. `=`, `/`
// and `+` are refused because the client only ever sees decoded ids.
export const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const IdentifierSchema = z.string().regex(IDENTIFIER_PATTERN, 'Invalid identifier');

export const GameIdSchema = IdentifierSchema;
export const AdIdSchema = IdentifierSchema;
export const ItemIdSchema = IdentifierSchema;

export const GameParamsSchema = z.object({ gameId: GameIdSchema });
export const SolveParamsSchema = z.object({ gameId: GameIdSchema, adId: AdIdSchema });
export const BuyParamsSchema = z.object({ gameId: GameIdSchema, itemId: ItemIdSchema });
