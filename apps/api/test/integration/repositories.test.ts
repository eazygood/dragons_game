import type { ProbabilityLabel } from '@dragons-game/contracts';
import { describe, expect, it } from 'vitest';

import type { AdAttempt } from '../../src/entities/ad-attempt.ts';
import type { NewGameRun } from '../../src/entities/game-run.ts';
import * as adAttemptRepository from '../../src/repositories/ad-attempt-repository.ts';
import * as gameRunRepository from '../../src/repositories/game-run-repository.ts';
import { useMigratedDatabase } from '../support/integration-db.ts';

const STARTED_AT = new Date('2026-11-24T10:00:00.000Z');

const ACTIVE_RUN: NewGameRun = {
  gameId: 'repo-run',
  strategy: 'calibrated',
  benchmarkId: null,
  lives: 3,
  gold: 0,
  dragonLevel: 0,
  turn: 0,
  score: 0,
  status: 'active',
  startedAt: STARTED_AT,
  endedAt: null,
};

const attemptOf = ({
  gameRunId,
  probability,
  dragonLevel,
  success,
  reward = 10,
}: Pick<AdAttempt, 'gameRunId' | 'dragonLevel' | 'success'> & {
  probability: ProbabilityLabel;
  reward?: number;
}): AdAttempt => ({
  gameRunId,
  adId: 'ad',
  probability,
  dragonLevel,
  turn: 1,
  reward,
  success,
  estimatedProbability: 0.95,
  expectedValue: 9.5,
  rule: 'best_expected_value',
  createdAt: STARTED_AT,
});

// Every test creates its own run under its own game id, so the order they run in is irrelevant.
describe('repositories', () => {
  const db = useMigratedDatabase();

  const createRun = (patch: Partial<NewGameRun> & Pick<NewGameRun, 'gameId'>) =>
    gameRunRepository.createOne({ db, gameRun: { ...ACTIVE_RUN, ...patch } });

  it('round-trips a game run through transform and back', async () => {
    const id = await gameRunRepository.createOne({ db, gameRun: ACTIVE_RUN });

    expect(await gameRunRepository.findOne({ db, gameId: ACTIVE_RUN.gameId })).toEqual({
      ...ACTIVE_RUN,
      id,
    });
  });

  it('returns null for an unknown game', async () => {
    await createRun({ gameId: 'repo-known' });

    expect(await gameRunRepository.findOne({ db, gameId: 'never-started' })).toBeNull();
  });

  it('updates live state in place, touching nothing else', async () => {
    const id = await createRun({ gameId: 'repo-update' });

    await gameRunRepository.updateOne({
      db,
      id,
      patch: { lives: 2, gold: 120, turn: 7, score: 300 },
    });

    expect(await gameRunRepository.findOne({ db, gameId: 'repo-update' })).toMatchObject({
      lives: 2,
      gold: 120,
      turn: 7,
      score: 300,
      dragonLevel: 0,
      status: 'active',
    });
  });

  it('finalises a run with its status and end time', async () => {
    const id = await createRun({ gameId: 'repo-finalise' });
    const endedAt = new Date('2026-11-24T10:05:00.000Z');

    await gameRunRepository.updateOne({ db, id, patch: { status: 'game_over', endedAt } });

    expect(await gameRunRepository.findOne({ db, gameId: 'repo-finalise' })).toMatchObject({
      status: 'game_over',
      endedAt,
    });
  });

  it('groups calibration counts by label, level and reward', async () => {
    const gameRunId = await createRun({ gameId: 'repo-calibration' });
    const seeds = [
      { probability: 'Sure thing', dragonLevel: 0, reward: 40, success: true },
      { probability: 'Sure thing', dragonLevel: 0, reward: 40, success: false },
      { probability: 'Sure thing', dragonLevel: 6, reward: 40, success: true },
      { probability: 'Sure thing', dragonLevel: 6, reward: 210, success: false },
    ] as const;

    for (const seed of seeds) {
      await adAttemptRepository.createOne({ db, attempt: attemptOf({ gameRunId, ...seed }) });
    }

    const counts = await adAttemptRepository.findCalibrationCounts({ db });

    expect(counts).toHaveLength(3);
    expect(counts).toEqual(
      expect.arrayContaining([
        { probability: 'Sure thing', dragonLevel: 0, reward: 40, attempts: 2, successes: 1 },
        { probability: 'Sure thing', dragonLevel: 6, reward: 40, attempts: 1, successes: 1 },
        { probability: 'Sure thing', dragonLevel: 6, reward: 210, attempts: 1, successes: 0 },
      ]),
    );
  });

  it('counts only the attempts of one benchmark when scoped to it', async () => {
    const outsideRunId = await createRun({ gameId: 'repo-outside' });
    const benchmarkRunId = await createRun({ gameId: 'repo-bench', benchmarkId: 'bench-scope' });
    const attempts = [
      attemptOf({ gameRunId: outsideRunId, probability: 'Gamble', dragonLevel: 0, success: false }),
      attemptOf({
        gameRunId: benchmarkRunId,
        probability: 'Gamble',
        dragonLevel: 0,
        success: true,
      }),
    ];

    for (const attempt of attempts) {
      await adAttemptRepository.createOne({ db, attempt });
    }

    expect(
      await adAttemptRepository.findCalibrationCounts({ db, benchmarkId: 'bench-scope' }),
    ).toEqual([{ probability: 'Gamble', dragonLevel: 0, reward: 10, attempts: 1, successes: 1 }]);
  });
});
