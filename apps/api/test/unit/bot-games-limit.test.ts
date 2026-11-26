import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_APP_LIMITS } from '../../src/app-limits.ts';
import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import { BOT_SLOT_RETRY_AFTER_SECONDS } from '../../src/mediators/bot-mediator.ts';

const BOT_GAMES_URL = '/api/bot-games';
const RATE_LIMIT_MAX = 2;

// With every slot taken the mediator answers before it touches the database or the upstream,
// so these routes can be exercised with no MySQL.
describe('POST /api/bot-games when the limit is reached', () => {
  let app: FastifyInstance;
  let takenSlot: ReturnType<FastifyInstance['botGames']['reserve']>;

  beforeAll(async () => {
    app = await buildApp({
      config: loadConfig({ env: {} }),
      logger: false,
      limits: {
        ...DEFAULT_APP_LIMITS,
        maxBotGames: 1,
        startGameRate: { max: RATE_LIMIT_MAX, timeWindowMs: 60_000 },
      },
    });
    takenSlot = app.botGames.reserve();
  });

  afterAll(async () => {
    // Shutdown waits for every slot, so the one this suite holds must be given back first.
    takenSlot?.release();
    await app.close();
  });

  it('answers 429 too_many_requests in the error envelope', async () => {
    const response = await app.inject({ method: 'POST', url: BOT_GAMES_URL });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      error: {
        code: 'too_many_requests',
        message: 'Too many bot games are running; try again when one has finished',
      },
    });
    expect(response.headers['retry-after']).toBe(String(BOT_SLOT_RETRY_AFTER_SECONDS));
  });

  it('rate limits the route itself, with a retry hint', async () => {
    await app.inject({ method: 'POST', url: BOT_GAMES_URL });

    const response = await app.inject({ method: 'POST', url: BOT_GAMES_URL });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ error: { code: 'too_many_requests' } });
    expect(response.json<{ error: { message: string } }>().error.message).toMatch(/retry in/);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.headers['x-ratelimit-limit']).toBe(String(RATE_LIMIT_MAX));
  });
});
