import { TARGET_SCORE } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { runBenchmark } from '../../src/cli/benchmark.ts';
import { loadConfig } from '../../src/config/index.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { adAttemptRepository, gameRunRepository } from '../../src/repositories/index.ts';
import { scriptGame } from '../support/scripted-game.ts';

const config = STRATEGY_CONFIG;
const SCRIPTED_TURNS = 3;
// The scripted game holds one game at a time, so runs must not overlap.
const SEQUENTIAL = 1;
const SEEDED_GAME_ID = 'seeded-before-benchmark';

describe('runBenchmark: history scoping and run accounting', () => {
  let db: Knex;
  let seededRunId: number;

  const countOfAttemptsSeededBefore = async () => {
    const [row] = await db(DbTables.AdAttempts)
      .where({ game_run_id: seededRunId })
      .count({ total: '*' });

    return Number(row?.total);
  };

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(() => db.destroy());

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await db(DbTables.GameRuns).delete();
    seededRunId = await gameRunRepository.db.createOne({
      db,
      gameRun: {
        gameId: SEEDED_GAME_ID,
        strategy: 'calibrated',
        benchmarkId: null,
        lives: 0,
        gold: 0,
        dragonLevel: 0,
        turn: 1,
        score: 0,
        status: 'game_over',
        startedAt: new Date(),
        endedAt: new Date(),
      },
    });
    await adAttemptRepository.db.createOne({
      db,
      attempt: {
        gameRunId: seededRunId,
        adId: 'seed-ad',
        probability: 'Gamble',
        dragonLevel: 0,
        turn: 1,
        reward: 50,
        success: false,
        estimatedProbability: 0.5,
        expectedValue: -10,
        rule: null,
        createdAt: new Date(),
      },
    });
  });

  let scriptedGame: ReturnType<typeof scriptGame>;

  beforeEach(() => {
    scriptedGame = scriptGame({ turnsUntilGameOver: SCRIPTED_TURNS });
  });

  it('keeps earlier history out of a cold benchmark without deleting it', async () => {
    const counts = vi.spyOn(adAttemptRepository.db, 'findCalibrationCounts');
    const summary = await runBenchmark({
      db,
      strategy: 'calibrated',
      runs: 1,
      readsAllHistory: false,
      concurrency: SEQUENTIAL,
      config,
    });

    expect(counts).toHaveBeenCalledWith(
      expect.objectContaining({ benchmarkId: summary.benchmarkId }),
    );
    expect(await countOfAttemptsSeededBefore()).toBe(1);
  });

  it('reads all accumulated calibration when readsAllHistory is set', async () => {
    const counts = vi.spyOn(adAttemptRepository.db, 'findCalibrationCounts');

    await runBenchmark({
      db,
      strategy: 'calibrated',
      runs: 1,
      readsAllHistory: true,
      concurrency: SEQUENTIAL,
      config,
    });

    expect(counts).toHaveBeenCalledWith(expect.objectContaining({ benchmarkId: null }));
  });

  it('groups every run of one invocation under a single benchmark id', async () => {
    const summary = await runBenchmark({
      db,
      strategy: 'baseline',
      runs: 3,
      readsAllHistory: false,
      concurrency: SEQUENTIAL,
      config,
    });
    const runs = await db<{ benchmark_id: string; strategy: string }>(DbTables.GameRuns)
      .where({ benchmark_id: summary.benchmarkId })
      .select('strategy');

    expect(runs).toHaveLength(3);
    expect(new Set(runs.map((run) => run.strategy))).toEqual(new Set(['baseline']));
    expect(summary).toMatchObject({
      runs: 3,
      strategy: 'baseline',
      passRate: 0,
      target: TARGET_SCORE,
    });
  });

  it('counts a run that failed and still summarises the rest', async () => {
    scriptedGame.startGame.mockRejectedValueOnce(
      new UpstreamUnavailableError({ message: 'The Mugloar server is unavailable' }),
    );

    const summary = await runBenchmark({
      db,
      strategy: 'baseline',
      runs: 3,
      readsAllHistory: false,
      concurrency: SEQUENTIAL,
      config,
    });

    expect(summary).toMatchObject({ runs: 3, failedRuns: 1 });
  });
});
