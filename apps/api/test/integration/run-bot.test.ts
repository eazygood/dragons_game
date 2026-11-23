import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { runBot } from '../../src/bot/run-bot.ts';
import { loadConfig } from '../../src/config/index.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import { DbTables } from '../../src/entities/db-tables.ts';
import { adAttemptRepository, gameRunRepository } from '../../src/repositories/index.ts';
import { createScriptedClient } from '../support/scripted-client.ts';

const config = STRATEGY_CONFIG;
const SCRIPTED_TURNS = 12;
// Rewards 31..42 over twelve successful turns.
const SCRIPTED_SCORE = 438;

const logger = { info: vi.fn(), warn: vi.fn() };

describe('runBot', () => {
  let db: Knex;
  let scriptedClient: ReturnType<typeof createScriptedClient>;

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(() => db.destroy());

  beforeEach(async () => {
    await db(DbTables.GameRuns).delete();
    scriptedClient = createScriptedClient({ turnsUntilGameOver: SCRIPTED_TURNS });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.info.mockClear();
    logger.warn.mockClear();
  });

  it('plays a stubbed game to its end and reports the final score', async () => {
    const result = await runBot({ db, client: scriptedClient, strategy: 'calibrated', config });

    expect(result).toMatchObject({
      score: SCRIPTED_SCORE,
      turns: SCRIPTED_TURNS,
      strategy: 'calibrated',
    });
    expect(await gameRunRepository.findOne({ db, gameId: result.gameId })).toMatchObject({
      status: 'game_over',
      score: SCRIPTED_SCORE,
    });
  });

  it('records a decision trail for the run', async () => {
    await runBot({ db, client: scriptedClient, strategy: 'calibrated', config });

    const attempts = await db(DbTables.AdAttempts).select(
      'estimated_probability',
      'expected_value',
    );

    expect(attempts).toHaveLength(SCRIPTED_TURNS);
    expect(attempts[0]).toEqual({ estimated_probability: 0.95, expected_value: 25.95 });
  });

  // Review Focus #3
  it('finalises the run when game over arrives on a read, not on a solve', async () => {
    scriptedClient.fetchAds.mockResolvedValueOnce({ status: 'game_over' });

    const result = await runBot({ db, client: scriptedClient, strategy: 'baseline', config });
    const run = await gameRunRepository.findOne({ db, gameId: result.gameId });

    expect(result.turns).toBe(0);
    expect(run).toMatchObject({ status: 'game_over' });
    expect(run?.endedAt).toBeInstanceOf(Date);
  });

  it('ends the run without another read once lives reach zero', async () => {
    scriptedClient.solveAd.mockResolvedValueOnce({
      status: 'ok',
      value: { success: false, lives: 0, gold: 0, score: 0, highScore: 0, turn: 1, message: 'x' },
    });

    const result = await runBot({ db, client: scriptedClient, strategy: 'baseline', config });

    expect(scriptedClient.fetchAds).toHaveBeenCalledOnce();
    expect(await gameRunRepository.findOne({ db, gameId: result.gameId })).toMatchObject({
      status: 'game_over',
      lives: 0,
    });
  });

  // Review Focus #5
  it('keeps playing when a persistence write fails', async () => {
    vi.spyOn(adAttemptRepository, 'createOne').mockRejectedValue(new Error('insert failed'));

    const result = await runBot({
      db,
      client: scriptedClient,
      strategy: 'calibrated',
      config,
      logger,
    });

    expect(result.score).toBe(SCRIPTED_SCORE);
    expect(logger.warn).toHaveBeenCalledTimes(SCRIPTED_TURNS);
  });

  it('does not swallow errors other than a failed persistence write', async () => {
    scriptedClient.solveAd.mockRejectedValueOnce(new Error('upstream exploded'));

    await expect(
      runBot({ db, client: scriptedClient, strategy: 'calibrated', config, logger }),
    ).rejects.toThrow('upstream exploded');
  });

  it('falls back to the prior calibration when the calibration read fails', async () => {
    vi.spyOn(adAttemptRepository, 'findCalibrationCounts').mockRejectedValue(
      new Error('read failed'),
    );

    const result = await runBot({
      db,
      client: scriptedClient,
      strategy: 'calibrated',
      config,
      logger,
    });

    expect(result.score).toBe(SCRIPTED_SCORE);
    expect(logger.warn).toHaveBeenCalledTimes(SCRIPTED_TURNS);
  });

  it('ignores stored history entirely in the baseline strategy', async () => {
    const spy = vi.spyOn(adAttemptRepository, 'findCalibrationCounts');

    await runBot({ db, client: scriptedClient, strategy: 'baseline', config });

    expect(spy).not.toHaveBeenCalled();
  });

  // Concurrent benchmark games share evidence, so a once-per-game read goes stale.
  it('re-reads stored history before every decision in the calibrated strategy', async () => {
    const spy = vi.spyOn(adAttemptRepository, 'findCalibrationCounts');

    await runBot({ db, client: scriptedClient, strategy: 'calibrated', config });

    expect(spy).toHaveBeenCalledTimes(SCRIPTED_TURNS);
  });

  it('stops at the turn ceiling rather than looping forever', async () => {
    const neverEndingClient = createScriptedClient({ turnsUntilGameOver: Infinity });

    const result = await runBot({
      db,
      client: neverEndingClient,
      strategy: 'baseline',
      config,
      maxTurns: 5,
    });

    expect(result.turns).toBe(5);
    expect(neverEndingClient.solveAd).toHaveBeenCalledTimes(5);
    expect(await gameRunRepository.findOne({ db, gameId: result.gameId })).toMatchObject({
      status: 'abandoned',
    });
  });
});
