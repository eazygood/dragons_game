import { describe, expect, it, vi } from 'vitest';

import { runBot } from '../../src/cli/run-bot.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { adAttemptRepository, gameRunRepository } from '../../src/repositories/index.ts';
import {
  BOT_CONFIG as config,
  SCRIPTED_SCORE,
  SCRIPTED_TURNS,
  botLogger as logger,
  useBotRunHarness,
} from '../support/bot-run.ts';

describe('runBot when something fails mid-game', () => {
  const harness = useBotRunHarness();

  // Review Focus #5
  it('keeps playing when a persistence write fails', async () => {
    vi.spyOn(adAttemptRepository.db, 'createOne').mockRejectedValue(new Error('insert failed'));

    const result = await runBot({ db: harness.db, strategy: 'calibrated', config, logger });

    expect(result.score).toBe(SCRIPTED_SCORE);
    expect(logger.warn).toHaveBeenCalledTimes(SCRIPTED_TURNS);
  });

  it('does not swallow errors other than a failed persistence write', async () => {
    harness.scriptedGame.solveAd.mockRejectedValueOnce(new Error('upstream exploded'));

    await expect(
      runBot({ db: harness.db, strategy: 'calibrated', config, logger }),
    ).rejects.toThrow('upstream exploded');
  });

  it('leaves no run active when an upstream error ends it', async () => {
    harness.scriptedGame.solveAd.mockRejectedValue(
      new UpstreamUnavailableError({ message: 'solve timed out' }),
    );

    await expect(
      runBot({ db: harness.db, strategy: 'calibrated', config, logger }),
    ).rejects.toThrow('solve timed out');

    const [run] = await harness
      .db<{ status: string; ended_at: Date | null }>(DbTables.GameRuns)
      .select('status', 'ended_at');

    expect(run?.status).toBe('abandoned');
    expect(run?.ended_at).not.toBeNull();
  });

  it('falls back to the prior calibration when the calibration read fails', async () => {
    vi.spyOn(adAttemptRepository.db, 'findCalibrationCounts').mockRejectedValue(
      new Error('read failed'),
    );

    const result = await runBot({ db: harness.db, strategy: 'calibrated', config, logger });

    expect(result.score).toBe(SCRIPTED_SCORE);
    expect(logger.warn).toHaveBeenCalledTimes(SCRIPTED_TURNS);
  });

  it('still reports the finished game and logs it when the final run write fails', async () => {
    const realUpdateOne = gameRunRepository.db.updateOne;

    // Per-turn state writes pass through; only the write that sets the final status fails.
    vi.spyOn(gameRunRepository.db, 'updateOne').mockImplementation((input) =>
      input.patch.status === undefined
        ? realUpdateOne(input)
        : Promise.reject(new Error('db went away')),
    );

    const result = await runBot({ db: harness.db, strategy: 'calibrated', config, logger });

    expect(result.turns).toBe(SCRIPTED_TURNS);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: result.gameId }),
      'finished run not finalised',
    );
    expect(
      await gameRunRepository.db.findOne({ db: harness.db, gameId: result.gameId }),
    ).toMatchObject({ status: 'active' });
  });
});
