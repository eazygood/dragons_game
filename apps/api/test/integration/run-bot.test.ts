import { DecisionRuleSchema } from '@bigbank-dragon/contracts';
import { describe, expect, it, vi } from 'vitest';

import { runBot } from '../../src/cli/run-bot.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { adAttemptRepository, gameRunRepository } from '../../src/repositories/index.ts';
import {
  BOT_CONFIG as config,
  SCRIPTED_SCORE,
  SCRIPTED_TURNS,
  useBotRunHarness,
} from '../support/bot-run.ts';
import { scriptGame } from '../support/scripted-game.ts';

describe('runBot', () => {
  const harness = useBotRunHarness();

  it('plays a stubbed game to its end and reports the final score', async () => {
    const result = await runBot({ db: harness.db, strategy: 'calibrated', config });

    expect(result).toMatchObject({
      score: SCRIPTED_SCORE,
      turns: SCRIPTED_TURNS,
      strategy: 'calibrated',
    });
    expect(
      await gameRunRepository.db.findOne({ db: harness.db, gameId: result.gameId }),
    ).toMatchObject({ status: 'game_over', score: SCRIPTED_SCORE });
  });

  it('records the estimate, expected value and engine rule of every attempt', async () => {
    await runBot({ db: harness.db, strategy: 'calibrated', config });

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

  // Review Focus #3
  it('finalises the run when game over arrives on a read, not on a solve', async () => {
    harness.scriptedGame.fetchAds.mockResolvedValueOnce({ status: 'game_over' });

    const result = await runBot({ db: harness.db, strategy: 'baseline', config });
    const run = await gameRunRepository.db.findOne({ db: harness.db, gameId: result.gameId });

    expect(result.turns).toBe(0);
    expect(run).toMatchObject({ status: 'game_over' });
    expect(run?.endedAt).toBeInstanceOf(Date);
  });

  it('ends the run without another read once lives reach zero', async () => {
    harness.scriptedGame.solveAd.mockResolvedValueOnce({
      status: 'ok',
      value: { success: false, lives: 0, gold: 0, score: 0, turn: 1, message: 'x' },
    });

    const result = await runBot({ db: harness.db, strategy: 'baseline', config });

    expect(harness.scriptedGame.fetchAds).toHaveBeenCalledOnce();
    expect(
      await gameRunRepository.db.findOne({ db: harness.db, gameId: result.gameId }),
    ).toMatchObject({ status: 'game_over', lives: 0 });
  });

  it('ignores stored history entirely in the baseline strategy', async () => {
    const spy = vi.spyOn(adAttemptRepository.db, 'findCalibrationCounts');

    await runBot({ db: harness.db, strategy: 'baseline', config });

    expect(spy).not.toHaveBeenCalled();
  });

  // Concurrent benchmark games share evidence, so a once-per-game read goes stale.
  it('re-reads stored history before every decision in the calibrated strategy', async () => {
    const spy = vi.spyOn(adAttemptRepository.db, 'findCalibrationCounts');

    await runBot({ db: harness.db, strategy: 'calibrated', config });

    expect(spy).toHaveBeenCalledTimes(SCRIPTED_TURNS);
  });

  it('stops at the turn ceiling rather than looping forever', async () => {
    vi.restoreAllMocks();
    const neverEndingGame = scriptGame({ turnsUntilGameOver: Infinity });

    const result = await runBot({ db: harness.db, strategy: 'baseline', config, maxTurns: 5 });

    expect(result.turns).toBe(5);
    expect(neverEndingGame.solveAd).toHaveBeenCalledTimes(5);
    expect(
      await gameRunRepository.db.findOne({ db: harness.db, gameId: result.gameId }),
    ).toMatchObject({ status: 'abandoned' });
  });
});
