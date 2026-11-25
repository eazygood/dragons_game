import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { DEFAULT_APP_LIMITS } from '../../src/app-limits.ts';
import { loadConfig } from '../../src/config/index.ts';
import { startGameRun } from '../../src/managers/game-manager/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { gameRunRepository } from '../../src/repositories/index.ts';
import { PLAYER_GAME_ID, newGameSnapshot, stubPlayerUpstream } from '../support/player-game.ts';

const RATE_LIMIT_MAX = 2;
const HTTP_TOO_MANY_REQUESTS = 429;
const UNLIMITED_READS = 6;
const TIGHT_RATE = { max: RATE_LIMIT_MAX, timeWindowMs: 60_000 };

const SOLVE_URL = `/api/games/${PLAYER_GAME_ID}/ads/sure1/solve`;
const BUY_URL = `/api/games/${PLAYER_GAME_ID}/shop/hpot/buy`;

describe('rate limits on the game routes', () => {
  let app: FastifyInstance;

  const post = ({ url }: { url: string }) => app.inject({ method: 'POST', url });

  const postUntilLimited = async ({ url }: { url: string }) => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt <= RATE_LIMIT_MAX; attempt += 1) {
      statuses.push((await post({ url })).statusCode);
    }

    return statuses;
  };

  beforeEach(async () => {
    app = await buildApp({
      config: loadConfig({ env: process.env }),
      logger: false,
      limits: { ...DEFAULT_APP_LIMITS, startGameRate: TIGHT_RATE, playMoveRate: TIGHT_RATE },
    });
    await app.db.migrate.latest();
    await app.db(DbTables.GameRuns).delete();
    stubPlayerUpstream();
    await startGameRun({ db: app.db, strategy: 'manual' });

    // game_id is unique, so every later start needs its own upstream id.
    let startedGames = 0;

    vi.mocked(gameRunRepository.mugloar.createOne).mockImplementation(() =>
      Promise.resolve(newGameSnapshot(`limited-${(startedGames += 1)}`)),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('answers 429 to the request after the start-game limit', async () => {
    const statuses = await postUntilLimited({ url: '/api/games' });

    expect(statuses).toEqual([201, 201, HTTP_TOO_MANY_REQUESTS]);
  });

  it('answers 429 to the request after the solve limit', async () => {
    const statuses = await postUntilLimited({ url: SOLVE_URL });

    expect(statuses).toEqual([200, 200, HTTP_TOO_MANY_REQUESTS]);
  });

  it('answers 429 to the request after the buy limit', async () => {
    const statuses = await postUntilLimited({ url: BUY_URL });

    // Gold is 0, so the two allowed buys are refused by the game, not by the limiter.
    expect(statuses).toEqual([409, 409, HTTP_TOO_MANY_REQUESTS]);
  });

  it('sends the error envelope and a retry hint with the 429', async () => {
    await postUntilLimited({ url: '/api/games' });

    const response = await post({ url: '/api/games' });

    expect(response.json()).toMatchObject({ error: { code: 'too_many_requests' } });
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('keeps one route exhausted without limiting another', async () => {
    await postUntilLimited({ url: '/api/games' });

    expect((await post({ url: SOLVE_URL })).statusCode).toBe(200);
  });

  it('leaves reads unlimited', async () => {
    const statuses = await Promise.all(
      Array.from(
        { length: UNLIMITED_READS },
        async () => (await app.inject({ url: `/api/games/${PLAYER_GAME_ID}` })).statusCode,
      ),
    );

    expect(statuses).toEqual(Array.from({ length: UNLIMITED_READS }, () => 200));
  });
});
