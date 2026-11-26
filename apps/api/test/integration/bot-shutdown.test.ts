import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { useMigratedDatabase } from '../support/integration-db.ts';
import { isPending } from '../support/is-pending.ts';
import { scriptGame } from '../support/scripted-game.ts';

const BOT_GAMES_URL = '/api/bot-games';
const LONG_GAME_TURNS = 10;
const TURNS_PLAYED_BEFORE_ABORT = 2;

describe('shutdown with a bot game in flight', () => {
  const config = loadConfig({ env: process.env });
  const verifierDb = useMigratedDatabase();
  let app: FastifyInstance;
  let scriptedGame: ReturnType<typeof scriptGame>;

  beforeEach(async () => {
    app = await buildApp({ config, logger: false });
    scriptedGame = scriptGame({ turnsUntilGameOver: LONG_GAME_TURNS });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aborts the game, lets its turn finish, and only then closes the pool', async () => {
    const defaultSolve = scriptedGame.solveAd.getMockImplementation();
    const { promise: secondSolveEntered, resolve: markSecondSolveEntered } =
      Promise.withResolvers<void>();
    const { promise: gate, resolve: openGate } = Promise.withResolvers<void>();
    let solveCalls = 0;

    if (!defaultSolve) {
      throw new Error('scriptGame must install a solveAd implementation');
    }

    scriptedGame.solveAd.mockImplementation(async (input) => {
      solveCalls += 1;

      if (solveCalls === TURNS_PLAYED_BEFORE_ABORT) {
        markSecondSolveEntered();
        await gate;
      }

      return defaultSolve(input);
    });

    const response = await app.inject({ method: 'POST', url: BOT_GAMES_URL });

    expect(response.statusCode).toBe(201);
    await secondSolveEntered;

    const closing = app.close();

    // The turn in flight still has to write to the database, so the pool must outlive it.
    expect(await isPending({ promise: closing })).toBe(true);

    openGate();
    await closing;

    const [run] = await verifierDb<{ status: string }>(DbTables.GameRuns).select('status');

    expect(run).toMatchObject({ status: 'abandoned' });
    expect(solveCalls).toBe(TURNS_PLAYED_BEFORE_ABORT);
  });

  it('closes at once when no bot game is running', async () => {
    await expect(app.close()).resolves.toBeUndefined();
  });
});
