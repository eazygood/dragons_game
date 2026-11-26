import { describe, expect, it, vi } from 'vitest';

import { playTurn } from '../../src/managers/bot-manager.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import * as adAttemptRepository from '../../src/repositories/ad-attempt-repository.ts';
import * as gameRunRepository from '../../src/repositories/game-run-repository.ts';
import * as purchaseRepository from '../../src/repositories/purchase-repository.ts';
import { useBotRunHarness } from '../support/bot-run.ts';
import { readStoredCalibration, startCalibratedRun } from '../support/bot-turns.ts';

const STARTING_SCORE_OF_SCRIPT = 31;
const LIVES_AT_THE_FLOOR = 2;
const GOLD_FOR_A_POTION = 100;

describe('a bot turn when its record cannot be written', () => {
  const harness = useBotRunHarness();

  const countOf = async ({ table }: { table: string }) =>
    Number((await harness.db(table).count({ total: '*' }))[0]?.total);

  it('plays on from the upstream state but leaves the lost attempt out of the calibration', async () => {
    const { context, shop, progress } = await startCalibratedRun({ db: harness.db });

    vi.spyOn(adAttemptRepository, 'createOne').mockRejectedValueOnce(new Error('insert failed'));

    const outcome = await playTurn({ context, shop, progress });

    expect(outcome.status).toBe('played');
    expect(outcome.progress.state).toMatchObject({ turn: 1, score: STARTING_SCORE_OF_SCRIPT });
    expect(outcome.progress.turns).toBe(1);
    expect(outcome.progress.calibration).toBe(progress.calibration);
  });

  it('rolls the turn back as a whole, so the stored run still shows the turn before', async () => {
    const { context, shop, progress } = await startCalibratedRun({ db: harness.db });

    vi.spyOn(adAttemptRepository, 'createOne').mockRejectedValueOnce(new Error('insert failed'));
    await playTurn({ context, shop, progress });

    expect(await countOf({ table: DbTables.AdAttempts })).toBe(0);
    expect(
      await gameRunRepository.findOne({ db: harness.db, gameId: context.run.gameId }),
    ).toMatchObject({
      turn: 0,
      score: 0,
    });
  });

  it('learns a solve that was stored, so memory equals what a fresh read gives', async () => {
    const { context, shop, progress } = await startCalibratedRun({ db: harness.db });

    const outcome = await playTurn({ context, shop, progress });
    const stored = await readStoredCalibration({ db: harness.db });

    expect(outcome.progress.calibration.evidence).toEqual(stored.evidence);
    expect(outcome.progress.calibration.evidence.size).toBe(1);
  });

  it('keeps a potion purchase and its state together: neither lands when the record fails', async () => {
    const { context, shop, progress } = await startCalibratedRun({ db: harness.db });
    const atTheFloor = {
      ...progress,
      state: { ...progress.state, lives: LIVES_AT_THE_FLOOR, gold: GOLD_FOR_A_POTION },
    };

    vi.spyOn(purchaseRepository, 'createOne').mockRejectedValueOnce(new Error('insert failed'));

    const outcome = await playTurn({ context, shop, progress: atTheFloor });

    expect(harness.scriptedGame.buyItem).toHaveBeenCalledOnce();
    expect(outcome.status).toBe('played');
    expect(outcome.progress.state.turn).toBe(1);
    expect(await countOf({ table: DbTables.Purchases })).toBe(0);
    expect(
      await gameRunRepository.findOne({ db: harness.db, gameId: context.run.gameId }),
    ).toMatchObject({
      turn: 0,
    });
  });

  it('leaves the progress it was given untouched when the turn throws', async () => {
    const { context, shop, progress } = await startCalibratedRun({ db: harness.db });
    const before = { ...progress, state: { ...progress.state } };

    harness.scriptedGame.solveAd.mockRejectedValueOnce(new Error('upstream exploded'));

    await expect(playTurn({ context, shop, progress })).rejects.toThrow('upstream exploded');
    expect(progress).toEqual(before);
  });
});
