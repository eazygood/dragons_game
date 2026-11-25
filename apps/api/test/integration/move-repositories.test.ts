import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import type { AdAttempt } from '../../src/entities/ad-attempt.ts';
import type { GameRunId } from '../../src/entities/game-run.ts';
import type { Purchase } from '../../src/entities/purchase.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import {
  adAttemptRepository,
  gameRunRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';

const STARTED_AT = new Date('2026-11-24T10:00:00.000Z');

const startRun = ({ db, gameId }: { db: Knex; gameId: string }): Promise<GameRunId> =>
  gameRunRepository.db.createOne({
    db,
    gameRun: {
      gameId,
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
    },
  });

const attemptOf = ({ gameRunId, turn }: Pick<AdAttempt, 'gameRunId' | 'turn'>): AdAttempt => ({
  gameRunId,
  adId: `ad-${turn}`,
  probability: 'Piece of cake',
  dragonLevel: 1,
  turn,
  reward: 40,
  success: true,
  estimatedProbability: 0.9,
  expectedValue: 36,
  rule: 'best_expected_value',
  createdAt: STARTED_AT,
});

const purchaseOf = ({ gameRunId, turn }: Pick<Purchase, 'gameRunId' | 'turn'>): Purchase => ({
  gameRunId,
  itemId: 'hpot',
  itemName: 'Healing potion',
  rule: 'survival_floor',
  cost: 50,
  turn,
  success: false,
  createdAt: STARTED_AT,
});

describe('move repositories', () => {
  let db: Knex;
  let runId: GameRunId;
  let otherRunId: GameRunId;

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(() => db.destroy());

  beforeEach(async () => {
    await db(DbTables.GameRuns).delete();
    runId = await startRun({ db, gameId: 'moves-run' });
    otherRunId = await startRun({ db, gameId: 'moves-other' });
  });

  it('finds one game run its ad attempts, oldest first, as entities', async () => {
    await adAttemptRepository.db.createOne({
      db,
      attempt: attemptOf({ gameRunId: runId, turn: 1 }),
    });
    await adAttemptRepository.db.createOne({
      db,
      attempt: attemptOf({ gameRunId: runId, turn: 2 }),
    });
    await adAttemptRepository.db.createOne({
      db,
      attempt: attemptOf({ gameRunId: otherRunId, turn: 1 }),
    });

    expect(await adAttemptRepository.db.findMany({ db, gameRunId: runId })).toEqual([
      attemptOf({ gameRunId: runId, turn: 1 }),
      attemptOf({ gameRunId: runId, turn: 2 }),
    ]);
  });

  it('finds one game run its purchases, oldest first, as entities', async () => {
    await purchaseRepository.db.createOne({
      db,
      purchase: purchaseOf({ gameRunId: runId, turn: 1 }),
    });
    await purchaseRepository.db.createOne({
      db,
      purchase: purchaseOf({ gameRunId: runId, turn: 2 }),
    });
    await purchaseRepository.db.createOne({
      db,
      purchase: purchaseOf({ gameRunId: otherRunId, turn: 1 }),
    });

    expect(await purchaseRepository.db.findMany({ db, gameRunId: runId })).toEqual([
      purchaseOf({ gameRunId: runId, turn: 1 }),
      purchaseOf({ gameRunId: runId, turn: 2 }),
    ]);
  });

  it('refuses a stored probability label this build does not know', async () => {
    await db(DbTables.AdAttempts).insert({
      game_run_id: runId,
      ad_id: 'odd',
      probability: 'Probably',
      dragon_level: 0,
      turn: 1,
      reward: 10,
      success: true,
      estimated_probability: 0.5,
      expected_value: 5,
      rule: null,
      created_at: STARTED_AT,
    });

    await expect(adAttemptRepository.db.findMany({ db, gameRunId: runId })).rejects.toThrow();
  });
});
