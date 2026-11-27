import { TARGET_SCORE } from '@dragons-game/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runBenchmark } from '../../src/cli/run-benchmark.ts';
import { STRATEGY_CONFIG } from '../../src/engine/strategy-config.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import * as adAttemptRepository from '../../src/repositories/ad-attempt-repository.ts';
import * as gameRepository from '../../src/repositories/game-repository/index.ts';
import { useMigratedDatabase } from '../support/integration-db.ts';
import { scriptGame } from '../support/scripted-game.ts';

const config = STRATEGY_CONFIG;
const SCRIPTED_TURNS = 3;
// The scripted game holds one game at a time, so runs must not overlap.
const SEQUENTIAL = 1;
// Below the scripted game's starting lives, so every turn is a solve and a run lasts exactly
// `SCRIPTED_TURNS` solves.
const SOLVING_CONFIG = { ...STRATEGY_CONFIG, livesFloor: 2 };
const SEEDED_GAME_ID = 'seeded-before-benchmark';
const MILLISECONDS_PER_SOLVE = 5000;
const SECONDS_PER_SCRIPTED_RUN = (SCRIPTED_TURNS * MILLISECONDS_PER_SOLVE) / 1000;

describe('runBenchmark: history scoping and run accounting', () => {
  const db = useMigratedDatabase();
  let seededRunId: number;

  const countOfAttemptsSeededBefore = async () => {
    const [row] = await db(DbTables.AdAttempts)
      .where({ game_run_id: seededRunId })
      .count({ total: '*' });

    return Number(row?.total);
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    seededRunId = await gameRepository.db.createOne({
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
    const counts = vi.spyOn(adAttemptRepository, 'findCalibrationCounts');
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
    const counts = vi.spyOn(adAttemptRepository, 'findCalibrationCounts');

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

  // Only the clock is faked, so the database still answers in real time.
  it('reports the mean duration from the stored start and end of each run', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T10:00:00.000Z'));

    const scriptedSolve = scriptedGame.solveAd.getMockImplementation();

    scriptedGame.solveAd.mockImplementation((input) => {
      vi.setSystemTime(Date.now() + MILLISECONDS_PER_SOLVE);

      return scriptedSolve ? scriptedSolve(input) : Promise.reject(new Error('no scripted solve'));
    });

    const summary = await runBenchmark({
      db,
      strategy: 'baseline',
      runs: 2,
      readsAllHistory: false,
      concurrency: SEQUENTIAL,
      config: SOLVING_CONFIG,
    });

    expect(summary.meanDurationInSeconds).toBe(SECONDS_PER_SCRIPTED_RUN);
  });

  it('leaves a run that never ended out of the mean duration', async () => {
    scriptedGame.solveAd.mockRejectedValue(new Error('upstream exploded'));
    vi.spyOn(gameRepository.db, 'updateOne').mockRejectedValue(new Error('db went away'));

    const summary = await runBenchmark({
      db,
      strategy: 'baseline',
      runs: 1,
      readsAllHistory: false,
      concurrency: SEQUENTIAL,
      config,
    });

    expect(summary).toMatchObject({ failedRuns: 1, meanDurationInSeconds: 0 });
  });
});
