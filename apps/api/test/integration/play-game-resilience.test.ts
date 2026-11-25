import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import { AdExpiredError, UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { MAX_CONSECUTIVE_FAILED_TURNS, playGame } from '../../src/managers/bot-manager/index.ts';
import { startGameRun } from '../../src/managers/game-manager/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { gameRunRepository } from '../../src/repositories/index.ts';
import { scriptGame } from '../support/scripted-game.ts';

// Below the scripted game's starting lives, so the engine solves every turn.
const config = { ...STRATEGY_CONFIG, livesFloor: 2 };
const SCRIPTED_TURNS = 12;
// Rewards 31..42 over twelve successful turns.
const SCRIPTED_SCORE = 438;
const TURNS_BEFORE_ABORT = 2;

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const timedOut = () => new UpstreamUnavailableError({ message: 'solve timed out' });

describe('playGame resilience', () => {
  let db: Knex;
  let scriptedGame: ReturnType<typeof scriptGame>;

  const playScriptedGame = async ({ signal }: { signal?: AbortSignal } = {}) => {
    const { run, state } = await startGameRun({ db, strategy: 'calibrated' });
    const playing = playGame({
      db,
      run,
      state,
      strategy: 'calibrated',
      calibrationBenchmarkId: null,
      config,
      logger,
      signal,
    });

    return { gameId: run.gameId, playing };
  };

  const statusOf = async ({ gameId }: { gameId: string }) =>
    (await gameRunRepository.db.findOne({ db, gameId }))?.status;

  // Wraps the scripted solve so chosen calls (1-based) fail and the rest play as scripted.
  const failSolveOnCalls = ({ calls, error }: { calls: number[]; error: () => Error }) => {
    const scriptedSolve = scriptedGame.solveAd.getMockImplementation();
    let call = 0;

    scriptedGame.solveAd.mockImplementation((input) => {
      call += 1;

      return calls.includes(call) || !scriptedSolve
        ? Promise.reject(error())
        : scriptedSolve(input);
    });
  };

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(() => db.destroy());

  beforeEach(async () => {
    await db(DbTables.GameRuns).delete();
    scriptedGame = scriptGame({ turnsUntilGameOver: SCRIPTED_TURNS });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.info.mockClear();
    logger.warn.mockClear();
  });

  it('plays on after a single upstream timeout, re-reading the board', async () => {
    scriptedGame.solveAd.mockRejectedValueOnce(timedOut());

    const { gameId, playing } = await playScriptedGame();

    await expect(playing).resolves.toMatchObject({ score: SCRIPTED_SCORE, turns: SCRIPTED_TURNS });
    expect(scriptedGame.solveAd).toHaveBeenCalledTimes(SCRIPTED_TURNS + 1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ consecutiveFailedTurns: 1 }),
      'turn failed; playing on',
    );
    expect(await statusOf({ gameId })).toBe('game_over');
  });

  it('plays on after an ad expires under it', async () => {
    scriptedGame.solveAd.mockRejectedValueOnce(new AdExpiredError({ message: 'expired' }));

    const { playing } = await playScriptedGame();

    await expect(playing).resolves.toMatchObject({ score: SCRIPTED_SCORE });
  });

  it('abandons the run after too many failed turns in a row, without retrying any', async () => {
    scriptedGame.solveAd.mockRejectedValue(timedOut());

    const { gameId, playing } = await playScriptedGame();

    await expect(playing).rejects.toBeInstanceOf(UpstreamUnavailableError);
    expect(scriptedGame.solveAd).toHaveBeenCalledTimes(MAX_CONSECUTIVE_FAILED_TURNS);
    expect(await statusOf({ gameId })).toBe('abandoned');
  });

  it('counts only consecutive failures, so a success in between resets the count', async () => {
    failSolveOnCalls({ calls: [1, 2, 4, 5], error: timedOut });

    const { playing } = await playScriptedGame();

    await expect(playing).resolves.toMatchObject({ score: SCRIPTED_SCORE });
  });

  it('stops before the next turn once the signal aborts, and abandons the run', async () => {
    const controller = new AbortController();
    const scriptedSolve = scriptedGame.solveAd.getMockImplementation();

    scriptedGame.solveAd.mockImplementation(async (input) => {
      const solved = await scriptedSolve?.(input);

      if (scriptedGame.solveAd.mock.calls.length === TURNS_BEFORE_ABORT) {
        controller.abort();
      }

      return solved ?? { status: 'game_over' };
    });

    const { gameId, playing } = await playScriptedGame({ signal: controller.signal });

    await expect(playing).resolves.toMatchObject({ turns: TURNS_BEFORE_ABORT });
    expect(await statusOf({ gameId })).toBe('abandoned');
  });
});
