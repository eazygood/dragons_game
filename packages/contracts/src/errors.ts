import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'invalid_request',
  'not_found',
  'conflict',
  'upstream_unavailable',
  'internal',
  'game_over',
  'too_many_requests',
  'service_unavailable',
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorBodySchema = z.object({
  error: z.object({ code: ApiErrorCodeSchema, message: z.string() }),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
