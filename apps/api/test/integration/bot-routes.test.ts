import { GameViewSchema } from '@dragons-game/contracts';
import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { gameRunRepository } from '../../src/repositories/index.ts';
import { solvedAdResponse } from '../support/player-game.ts';
import { scriptGame } from '../support/scripted-game.ts';

const BOT_GAMES_URL = '/api/bot-games';
// Under the default thresholds the engine solves both turns: 31 + 32.
const SCRIPTED_TURNS = 2;
const SCRIPTED_SCORE = 63;
const BACKGROUND_GAME_TIMEOUT_MS = 5000;

describe('bot routes', () => {
  let app: FastifyInstance;
  let scriptedGame: ReturnType<typeof scriptGame>;

  const startBotGame = async () => {
    const response = await app.inject({ method: 'POST', url: BOT_GAMES_URL });

    return { response, gameId: GameViewSchema.parse(response.json()).state.gameId };
  };

  const waitForRunToEnd = ({ gameId }: { gameId: string }) =>
    vi.waitFor(
      async () => {
        const run = await gameRunRepository.db.findOne({ db: app.db, gameId });

        expect(run?.status).not.toBe('active');

        return run;
      },
      { timeout: BACKGROUND_GAME_TIMEOUT_MS },
    );

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ env: process.env }), logger: false });
    await app.db.migrate.rollback(undefined, true);
    await app.db.migrate.latest();
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    await app.db(DbTables.GameRuns).delete();
    scriptedGame = scriptGame({ turnsUntilGameOver: SCRIPTED_TURNS });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers 201 with an active calibrated game before the bot has finished', async () => {
    const { promise: shopReleased, resolve: releaseShop } = Promise.withResolvers<void>();

    // The bot's first call waits here, so only a route that does not await the game can answer.
    scriptedGame.fetchShop.mockImplementationOnce(async () => {
      await shopReleased;

      return { status: 'ok', value: [...RECORDED_SHOP_ITEMS] };
    });

    const { response, gameId } = await startBotGame();

    expect(response.statusCode).toBe(201);
    expect(GameViewSchema.parse(response.json())).toMatchObject({ status: 'active' });
    expect(await gameRunRepository.db.findOne({ db: app.db, gameId })).toMatchObject({
      strategy: 'calibrated',
      status: 'active',
    });

    releaseShop();
    await waitForRunToEnd({ gameId });
  });

  it('plays the game to its end in the background', async () => {
    const { gameId } = await startBotGame();

    expect(await waitForRunToEnd({ gameId })).toMatchObject({
      status: 'game_over',
      score: SCRIPTED_SCORE,
    });

    const rules: unknown[] = await app.db(DbTables.AdAttempts).pluck('rule');

    expect(rules).toHaveLength(SCRIPTED_TURNS);
    expect(rules).not.toContain(null);
  });

  it('abandons the run and keeps the API up when the upstream fails mid-game', async () => {
    const unhandledRejection = vi.fn();
    const logError = vi.spyOn(app.log, 'error');

    scriptedGame.solveAd
      .mockResolvedValueOnce(solvedAdResponse())
      .mockRejectedValue(new UpstreamUnavailableError({ message: 'solve timed out' }));
    process.on('unhandledRejection', unhandledRejection);

    try {
      const { gameId } = await startBotGame();
      const run = await waitForRunToEnd({ gameId });

      // Node raises unhandled rejections after the microtask queue drains.
      await new Promise((resolve) => setImmediate(resolve));

      expect(run).toMatchObject({ status: 'abandoned', score: 30 });
      expect(run?.endedAt).toBeInstanceOf(Date);
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith(expect.objectContaining({ gameId }), 'bot game failed');
      expect((await app.inject({ url: '/api/health' })).statusCode).toBe(200);
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });

  it('answers 502 when the upstream is down at start', async () => {
    scriptedGame.startGame.mockRejectedValueOnce(new UpstreamUnavailableError({ message: 'down' }));

    const response = await app.inject({ method: 'POST', url: BOT_GAMES_URL });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({ error: { code: 'upstream_unavailable' } });
    expect(await app.db(DbTables.GameRuns).select('id')).toEqual([]);
  });
});
