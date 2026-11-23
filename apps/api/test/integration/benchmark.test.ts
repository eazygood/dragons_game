import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { runBenchmark } from '../../src/bot/benchmark.ts';
import { loadConfig } from '../../src/config/index.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import { DbTables } from '../../src/entities/db-tables.ts';
import { adAttemptRepository, gameRunRepository } from '../../src/repositories/index.ts';
import { createScriptedClient } from '../support/scripted-client.ts';

const config = STRATEGY_CONFIG;
const SCRIPTED_TURNS = 3;
// The scripted client holds one game at a time, so runs must not overlap.
const SEQUENTIAL = 1;
const SEEDED_GAME_ID = 'seeded-before-benchmark';

describe('runBenchmark', () => {
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

  beforeEach(async () => {
    await db(DbTables.GameRuns).delete();
    seededRunId = await gameRunRepository.createOne({
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
    await adAttemptRepository.createOne({
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
        createdAt: new Date(),
      },
    });
  });

  const client = () => createScriptedClient({ turnsUntilGameOver: SCRIPTED_TURNS });

  it('truncates calibration before a cold benchmark', async () => {
    await runBenchmark({
      db,
      client: client(),
      strategy: 'calibrated',
      runs: 1,
      warm: false,
      concurrency: SEQUENTIAL,
      config,
    });

    expect(await countOfAttemptsSeededBefore()).toBe(0);
  });

  it('keeps accumulated calibration when warm', async () => {
    await runBenchmark({
      db,
      client: client(),
      strategy: 'calibrated',
      runs: 1,
      warm: true,
      concurrency: SEQUENTIAL,
      config,
    });

    expect(await countOfAttemptsSeededBefore()).toBeGreaterThan(0);
  });

  it('groups every run of one invocation under a single benchmark id', async () => {
    const summary = await runBenchmark({
      db,
      client: client(),
      strategy: 'baseline',
      runs: 3,
      warm: false,
      concurrency: SEQUENTIAL,
      config,
    });
    const runs = await gameRunRepository.findMany({ db, benchmarkId: summary.benchmarkId });

    expect(runs).toHaveLength(3);
    expect(new Set(runs.map((run) => run.strategy))).toEqual(new Set(['baseline']));
    expect(summary).toMatchObject({ runs: 3, strategy: 'baseline', passRate: 0 });
  });
});
