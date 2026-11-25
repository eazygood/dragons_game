import type { RateLimit } from '../app-limits.ts';

// The shape @fastify/rate-limit reads from a route's `config`.
export const rateLimitConfig = ({ rate }: { rate: RateLimit }) => ({
  rateLimit: { max: rate.max, timeWindow: rate.timeWindowMs },
});
