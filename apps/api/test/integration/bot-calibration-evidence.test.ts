import type { Ad, ProbabilityLabel } from '@bigbank-dragon/contracts';
import { describe, expect, it, vi } from 'vitest';

import { CALIBRATION_REFRESH_TURNS } from '../../src/managers/bot-manager/play-turn.ts';
import { adAttemptRepository } from '../../src/repositories/index.ts';
import { SCRIPTED_TURNS, useBotRunHarness } from '../support/bot-run.ts';
import { playToTheEnd, readStoredCalibration, startCalibratedRun } from '../support/bot-turns.ts';
import { seedEvidence } from '../support/seed-evidence.ts';

const FAIL_EVERY_NTH_SOLVE = 3;

const BOARD_SHAPE: { label: ProbabilityLabel; reward: number }[] = [
  { label: 'Sure thing', reward: 40 },
  { label: 'Piece of cake', reward: 120 },
  { label: 'Gamble', reward: 200 },
];

const boardOf = ({ turnId }: { turnId: string }): Ad[] =>
  BOARD_SHAPE.map(({ label, reward }) => ({
    adId: `${turnId}-${label}`,
    message: 'Escort a wagon',
    reward,
    expiresIn: 5,
    probability: label,
    wasEncrypted: false,
  }));

describe('calibration carried through a bot game', () => {
  const harness = useBotRunHarness();

  // The scripted game offers one ad per turn; this widens it to three across two reward bands
  // and fails some solves, so the game's evidence lands in several cells with both outcomes.
  const widenBoardAndFailSomeSolves = () => {
    const { fetchAds, solveAd } = harness.scriptedGame;
    const scriptedFetch = fetchAds.getMockImplementation();
    const scriptedSolve = solveAd.getMockImplementation();
    let solves = 0;

    fetchAds.mockImplementation(async (input) => {
      const listing = await scriptedFetch?.(input);

      return listing?.status === 'ok'
        ? { status: 'ok', value: boardOf({ turnId: listing.value[0]?.adId ?? '' }) }
        : { status: 'game_over' };
    });
    solveAd.mockImplementation(async (input) => {
      solves += 1;

      const solved = await scriptedSolve?.(input);

      return solved?.status === 'ok' && solves % FAIL_EVERY_NTH_SOLVE === 0
        ? { status: 'ok', value: { ...solved.value, success: false } }
        : (solved ?? { status: 'game_over' });
    });
  };

  it('equals a fresh read of the table after a whole game', async () => {
    await seedEvidence({
      db: harness.db,
      cells: [{ label: 'Sure thing', level: 0, reward: 40, attempts: 5, successes: 4 }],
    });
    widenBoardAndFailSomeSolves();

    const fixture = await startCalibratedRun({
      db: harness.db,
      calibration: await readStoredCalibration({ db: harness.db }),
    });
    const progress = await playToTheEnd(fixture);
    const stored = await readStoredCalibration({ db: harness.db });

    expect(progress.turns).toBe(SCRIPTED_TURNS);
    expect(progress.calibration.evidence).toEqual(stored.evidence);
    expect(progress.calibration.evidence.size).toBeGreaterThan(1);
  });

  it('picks up evidence another game wrote after this one started', async () => {
    const fixture = await startCalibratedRun({ db: harness.db });

    await seedEvidence({
      db: harness.db,
      cells: [{ label: 'Walk in the park', level: 0, reward: 40, attempts: 3, successes: 3 }],
    });

    const progress = await playToTheEnd(fixture);
    const stored = await readStoredCalibration({ db: harness.db });

    expect(progress.turns).toBeGreaterThan(CALIBRATION_REFRESH_TURNS);
    expect(progress.calibration.evidence).toEqual(stored.evidence);
  });

  it('keeps what the game learned when a later read fails', async () => {
    const fixture = await startCalibratedRun({ db: harness.db });

    vi.spyOn(adAttemptRepository.db, 'findCalibrationCounts').mockRejectedValue(
      new Error('read failed'),
    );

    const progress = await playToTheEnd(fixture);

    vi.restoreAllMocks();

    const stored = await readStoredCalibration({ db: harness.db });

    expect(progress.turns).toBeGreaterThan(CALIBRATION_REFRESH_TURNS);
    expect(progress.calibration.evidence).toEqual(stored.evidence);
  });
});
