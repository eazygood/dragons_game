import type { ProbabilityLabel } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import type { AdAttempt } from '../../src/entities/ad-attempt.ts';
import type { GameRunId, NewGameRun } from '../../src/entities/game-run.ts';
import {
  adAttemptRepository,
  gameRunRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';

const STARTED_AT = new Date('2026-11-24T10:00:00.000Z');

const ACTIVE_RUN: NewGameRun = {
  gameId: 'repo-active',
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
}: Pick<AdAttempt, 'gameRunId' | 'dragonLevel' | 'success'> & {
  probability: ProbabilityLabel;
}): AdAttempt => ({
  gameRunId,
  adId: 'ad',
  probability,
  dragonLevel,
  turn: 1,
  reward: 10,
  wasEncrypted: false,
  success,
  estimatedProbability: 0.95,
  expectedValue: 9.5,
  createdAt: STARTED_AT,
});

describe('repositories', () => {
  let db: Knex;
  let id: GameRunId;

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(() => db.destroy());

  it('round-trips a game run through transform and back', async () => {
    id = await gameRunRepository.createOne({ db, gameRun: ACTIVE_RUN });

    expect(await gameRunRepository.findOne({ db, gameId: ACTIVE_RUN.gameId })).toEqual({
      ...ACTIVE_RUN,
      id,
    });
  });

  it('returns null for an unknown game', async () => {
    expect(await gameRunRepository.findOne({ db, gameId: 'never-started' })).toBeNull();
  });

  it('updates live state in place, touching nothing else', async () => {
    await gameRunRepository.updateOne({
      db,
      id,
      patch: { lives: 2, gold: 120, turn: 7, score: 300 },
    });

    expect(await gameRunRepository.findOne({ db, gameId: ACTIVE_RUN.gameId })).toMatchObject({
      lives: 2,
      gold: 120,
      turn: 7,
      score: 300,
      dragonLevel: 0,
      status: 'active',
    });
  });

  it('finalises a run with its status and end time', async () => {
    const endedAt = new Date('2026-11-24T10:05:00.000Z');

    await gameRunRepository.updateOne({ db, id, patch: { status: 'game_over', endedAt } });

    expect(await gameRunRepository.findOne({ db, gameId: ACTIVE_RUN.gameId })).toMatchObject({
      status: 'game_over',
      endedAt,
    });
  });

  it('groups calibration counts by label and level', async () => {
    const seeds = [
      { probability: 'Sure thing', dragonLevel: 0, success: true },
      { probability: 'Sure thing', dragonLevel: 0, success: false },
      { probability: 'Sure thing', dragonLevel: 6, success: true },
    ] as const;

    for (const seed of seeds) {
      await adAttemptRepository.createOne({ db, attempt: attemptOf({ gameRunId: id, ...seed }) });
    }

    const counts = await adAttemptRepository.findCalibrationCounts({ db });

    expect(counts).toHaveLength(2);
    expect(counts).toContainEqual({
      probability: 'Sure thing',
      dragonLevel: 0,
      attempts: 2,
      successes: 1,
    });
    expect(counts).toContainEqual({
      probability: 'Sure thing',
      dragonLevel: 6,
      attempts: 1,
      successes: 1,
    });
  });

  it('returns no counts after a truncation, which is what a cold benchmark needs', async () => {
    await adAttemptRepository.deleteMany({ db });

    expect(await adAttemptRepository.findCalibrationCounts({ db })).toEqual([]);
  });

  it('records a failed purchase', async () => {
    await purchaseRepository.createOne({
      db,
      purchase: {
        gameRunId: id,
        itemId: 'hpot',
        cost: 50,
        turn: 8,
        success: false,
        createdAt: STARTED_AT,
      },
    });

    expect(await db('purchases').where({ game_run_id: id }).select('success')).toEqual([
      { success: 0 },
    ]);
  });

  it('finds every run of one benchmark invocation', async () => {
    for (const gameId of ['bench-1', 'bench-2']) {
      await gameRunRepository.createOne({
        db,
        gameRun: { ...ACTIVE_RUN, gameId, benchmarkId: 'bench-a' },
      });
    }

    await gameRunRepository.createOne({
      db,
      gameRun: { ...ACTIVE_RUN, gameId: 'bench-3', benchmarkId: 'bench-b' },
    });

    const runs = await gameRunRepository.findMany({ db, benchmarkId: 'bench-a' });

    expect(runs.map(({ gameId }) => gameId)).toEqual(['bench-1', 'bench-2']);
  });
});
