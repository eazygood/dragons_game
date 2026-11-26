import { DecisionRuleSchema, HEALING_POTION_ID } from '@dragons-game/contracts';
import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import { describe, expect, it, vi } from 'vitest';

import { CALIBRATION_REFRESH_TURNS, playNewGame } from '../../src/managers/bot-manager.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import * as adAttemptRepository from '../../src/repositories/ad-attempt-repository.ts';
import * as gameRunRepository from '../../src/repositories/game-run-repository.ts';
import {
  BOT_CONFIG as config,
  SCRIPTED_SCORE,
  SCRIPTED_TURNS,
  useBotRunHarness,
} from '../support/bot-run.ts';
import { scriptGame } from '../support/scripted-game.ts';
import { seedEvidence } from '../support/seed-evidence.ts';

// A hundred failed solves of the one label the scripted game offers, at its level and rewards.
const ADVERSE_HISTORY = [
  { label: 'Sure thing', level: 0, reward: 31, attempts: 100, successes: 0 },
] as const;
const PRIOR_ESTIMATE = 0.95;
const ESTIMATES_AFTER_ONE_AND_TWO_SUCCESSES = [0.9667, 0.975];
const ESTIMATE_PRECISION = 3;

// One read at the start, then one before every CALIBRATION_REFRESH_TURNS-th turn after it.
const EXPECTED_CALIBRATION_READS = 1 + Math.floor((SCRIPTED_TURNS - 1) / CALIBRATION_REFRESH_TURNS);

describe('playNewGame', () => {
  const harness = useBotRunHarness();

  const attemptsOf = ({ gameId }: { gameId: string }) =>
    harness
      .db(DbTables.AdAttempts)
      .join(DbTables.GameRuns, `${DbTables.GameRuns}.id`, `${DbTables.AdAttempts}.game_run_id`)
      .where(`${DbTables.GameRuns}.game_id`, gameId)
      .orderBy(`${DbTables.AdAttempts}.id`)
      .select<{ estimated_probability: number; rule: string }[]>(
        `${DbTables.AdAttempts}.estimated_probability`,
        `${DbTables.AdAttempts}.rule`,
      );

  it('plays a stubbed game to its end and reports the final score', async () => {
    const result = await playNewGame({ db: harness.db, strategy: 'calibrated', config });

    expect(result).toMatchObject({
      score: SCRIPTED_SCORE,
      turns: SCRIPTED_TURNS,
      strategy: 'calibrated',
    });
    expect(
      await gameRunRepository.findOne({ db: harness.db, gameId: result.gameId }),
    ).toMatchObject({ status: 'game_over', score: SCRIPTED_SCORE });
  });

  it('records the estimate, expected value and engine rule of every attempt', async () => {
    await playNewGame({ db: harness.db, strategy: 'calibrated', config });

    const attempts = await harness
      .db(DbTables.AdAttempts)
      .select<{ estimated_probability: number; expected_value: number; rule: unknown }[]>(
        'estimated_probability',
        'expected_value',
        'rule',
      );

    expect(attempts).toHaveLength(SCRIPTED_TURNS);
    expect(attempts[0]).toMatchObject({ estimated_probability: 0.95, expected_value: 25.95 });
    expect(attempts.filter(({ rule }) => !DecisionRuleSchema.safeParse(rule).success)).toEqual([]);
  });

  it('finalises the run when game over arrives on a read, not on a solve', async () => {
    harness.scriptedGame.fetchAds.mockResolvedValueOnce({ status: 'game_over' });

    const result = await playNewGame({ db: harness.db, strategy: 'baseline', config });
    const run = await gameRunRepository.findOne({ db: harness.db, gameId: result.gameId });

    expect(result.turns).toBe(0);
    expect(run).toMatchObject({ status: 'game_over' });
    expect(run?.endedAt).toBeInstanceOf(Date);
  });

  it('ends the run without another read once lives reach zero', async () => {
    harness.scriptedGame.solveAd.mockResolvedValueOnce({
      status: 'ok',
      value: { success: false, lives: 0, gold: 0, score: 0, turn: 1, message: 'x' },
    });

    const result = await playNewGame({ db: harness.db, strategy: 'baseline', config });

    expect(harness.scriptedGame.fetchAds).toHaveBeenCalledOnce();
    expect(
      await gameRunRepository.findOne({ db: harness.db, gameId: result.gameId }),
    ).toMatchObject({ status: 'game_over', lives: 0 });
  });

  it('plays the baseline on the prior, however badly the stored history reads', async () => {
    await seedEvidence({ db: harness.db, cells: [...ADVERSE_HISTORY] });

    const { gameId } = await playNewGame({ db: harness.db, strategy: 'baseline', config });
    const [first] = await attemptsOf({ gameId });

    expect(first).toMatchObject({
      estimated_probability: PRIOR_ESTIMATE,
      rule: 'best_expected_value',
    });
  });

  it('prices the calibrated strategy from the stored history, and falls back to the safest ad', async () => {
    await seedEvidence({ db: harness.db, cells: [...ADVERSE_HISTORY] });

    const { gameId, score } = await playNewGame({ db: harness.db, strategy: 'calibrated', config });
    const [first] = await attemptsOf({ gameId });

    expect(first?.estimated_probability).toBeLessThan(config.minimumProbability);
    expect(first?.rule).toBe('safest_available');
    expect(score).toBe(SCRIPTED_SCORE);
  });

  it('reads the history at the start and every few turns, learning from the game between', async () => {
    const readHistory = vi.spyOn(adAttemptRepository, 'findCalibrationCounts');

    const { gameId } = await playNewGame({ db: harness.db, strategy: 'calibrated', config });
    const estimates = (await attemptsOf({ gameId })).map(({ estimated_probability: value }) =>
      Number(value),
    );

    expect(readHistory).toHaveBeenCalledTimes(EXPECTED_CALIBRATION_READS);
    expect(estimates[0]).toBe(PRIOR_ESTIMATE);
    ESTIMATES_AFTER_ONE_AND_TWO_SUCCESSES.forEach((expected, index) =>
      expect(estimates[index + 1]).toBeCloseTo(expected, ESTIMATE_PRECISION),
    );
  });

  it('buys a potion at the floor once gold covers it, and carries the bought life to the end', async () => {
    const potionCost = RECORDED_SHOP_ITEMS.find(({ id }) => id === HEALING_POTION_ID)?.cost;
    // At the scripted game's starting lives, so the floor holds until the first potion lifts it.
    const floorAtStartingLives = { ...config, livesFloor: 3 };

    const result = await playNewGame({
      db: harness.db,
      strategy: 'calibrated',
      config: floorAtStartingLives,
    });

    expect(harness.scriptedGame.buyItem).toHaveBeenCalledOnce();
    expect(await harness.db(DbTables.Purchases).select('item_id', 'rule', 'success')).toEqual([
      { item_id: HEALING_POTION_ID, rule: 'survival_floor', success: 1 },
    ]);
    expect(
      await gameRunRepository.findOne({ db: harness.db, gameId: result.gameId }),
    ).toMatchObject({ lives: 4, dragonLevel: 0, gold: result.score - (potionCost ?? 0) });
  });

  it('stops at the turn ceiling rather than looping forever', async () => {
    vi.restoreAllMocks();
    const neverEndingGame = scriptGame({ turnsUntilGameOver: Infinity });

    const result = await playNewGame({ db: harness.db, strategy: 'baseline', config, maxTurns: 5 });

    expect(result.turns).toBe(5);
    expect(neverEndingGame.solveAd).toHaveBeenCalledTimes(5);
    expect(
      await gameRunRepository.findOne({ db: harness.db, gameId: result.gameId }),
    ).toMatchObject({ status: 'abandoned' });
  });
});
