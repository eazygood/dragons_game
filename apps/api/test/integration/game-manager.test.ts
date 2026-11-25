import type { Ad, GameState, Reasoning, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/entities/db-tables.ts';
import type { GameRun } from '../../src/entities/game-run.ts';
import { PersistenceFailedError } from '../../src/errors/errors.ts';
import { buyItem, finishRun, solveAd, startGame } from '../../src/managers/game-manager/index.ts';
import {
  adAttemptRepository,
  gameRunRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';

const CLAW_HONING: ShopItem = { id: 'ch', name: 'Claw Honing', cost: 300 };

const AD: Ad = {
  adId: 'a1',
  message: 'Help someone',
  reward: 20,
  expiresIn: 5,
  probability: 'Quite likely',
  wasEncrypted: false,
};

const REASONING = {
  rule: 'best_expected_value',
  estimatedProbability: 0.8,
  expectedValue: 12.5,
  consideredCount: 4,
} as const;

const PURCHASE_REASONING: Reasoning = {
  rule: 'level_up',
  estimatedProbability: null,
  expectedValue: null,
  consideredCount: 11,
};

describe('game manager', () => {
  let db: Knex;
  let run: GameRun;
  let state: GameState;

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(() => db.destroy());

  beforeEach(async () => {
    await db(DbTables.GameRuns).delete();
    vi.spyOn(gameRunRepository.mugloar, 'createOne').mockResolvedValue({
      gameId: 'mgr-game',
      lives: 3,
      gold: 0,
      level: 0,
      score: 0,
      highScore: 0,
      turn: 0,
    });
    vi.spyOn(adAttemptRepository.mugloar, 'createOne').mockResolvedValue({
      status: 'ok',
      value: { success: true, lives: 3, gold: 20, score: 20, turn: 1, message: 'ok' },
    });
    vi.spyOn(purchaseRepository.mugloar, 'createOne').mockResolvedValue({
      status: 'ok',
      value: { success: true, gold: 0, lives: 3, level: 2, turn: 5 },
    });

    ({ run, state } = await startGame({ db, strategy: 'calibrated' }));
    state = { ...state, gold: 300, turn: 4 };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists a new run in its starting state', async () => {
    expect(await gameRunRepository.db.findOne({ db, gameId: run.gameId })).toMatchObject({
      lives: 3,
      gold: 0,
      dragonLevel: 0,
      turn: 0,
      score: 0,
      status: 'active',
      benchmarkId: null,
    });
  });

  it('returns the solve outcome with the new state', async () => {
    expect(await solveAd({ db, run, state, ad: AD, reasoning: REASONING })).toEqual({
      status: 'ok',
      value: {
        state: expect.objectContaining({ gold: 20, score: 20, turn: 1 }) as GameState,
        success: true,
        message: 'ok',
      },
    });
  });

  it('writes an ad attempt carrying the prediction it acted on', async () => {
    await solveAd({ db, run, state, ad: AD, reasoning: REASONING });

    expect(await db(DbTables.AdAttempts).first()).toMatchObject({
      ad_id: 'a1',
      probability: 'Quite likely',
      dragon_level: 0,
      estimated_probability: 0.8,
      expected_value: 12.5,
      rule: 'best_expected_value',
      success: 1,
    });
    expect(await gameRunRepository.db.findOne({ db, gameId: run.gameId })).toMatchObject({
      gold: 20,
      score: 20,
      turn: 1,
    });
  });

  it('raises the dragon level and the purchase row in one transaction', async () => {
    await buyItem({ db, run, state, item: CLAW_HONING, reasoning: PURCHASE_REASONING });

    expect(await gameRunRepository.db.findOne({ db, gameId: run.gameId })).toMatchObject({
      dragonLevel: 2,
    });
    expect(await db(DbTables.Purchases).first()).toMatchObject({
      item_id: 'ch',
      item_name: 'Claw Honing',
      rule: 'level_up',
      success: 1,
    });
  });

  it('leaves no purchase row and no level change when the transaction fails', async () => {
    vi.spyOn(purchaseRepository.db, 'createOne').mockRejectedValueOnce(new Error('insert failed'));

    const attempt = buyItem({ db, run, state, item: CLAW_HONING, reasoning: PURCHASE_REASONING });

    await expect(attempt).rejects.toBeInstanceOf(PersistenceFailedError);
    await expect(attempt).rejects.toMatchObject({
      turnResult: { state: { dragonLevel: 2, turn: 5 }, success: true, message: null },
    });
    expect(await gameRunRepository.db.findOne({ db, gameId: run.gameId })).toMatchObject({
      dragonLevel: 0,
    });
    expect(await db(DbTables.Purchases).count({ count: '*' })).toEqual([{ count: 0 }]);
  });

  // Review Focus #4
  it('advances the turn but not the level when a purchase fails', async () => {
    vi.mocked(purchaseRepository.mugloar.createOne).mockResolvedValue({
      status: 'ok',
      value: { success: false, gold: 10, lives: 3, level: 0, turn: 6 },
    });

    const result = await buyItem({
      db,
      run,
      state,
      item: CLAW_HONING,
      reasoning: PURCHASE_REASONING,
    });

    expect(result).toMatchObject({
      status: 'ok',
      value: { success: false, message: null, state: { turn: 6, dragonLevel: 0 } },
    });
    expect(await db(DbTables.Purchases).first()).toMatchObject({
      item_id: 'ch',
      success: 0,
      turn: 6,
    });
  });

  it('reports game over from the manager rather than throwing', async () => {
    vi.mocked(adAttemptRepository.mugloar.createOne).mockResolvedValue({ status: 'game_over' });

    await expect(solveAd({ db, run, state, ad: AD, reasoning: REASONING })).resolves.toEqual({
      status: 'game_over',
    });
    expect(await db(DbTables.AdAttempts).count({ count: '*' })).toEqual([{ count: 0 }]);
  });

  it('closes a run when it finishes', async () => {
    await finishRun({ db, run, state: { ...state, score: 1234 } });

    const finished = await gameRunRepository.db.findOne({ db, gameId: run.gameId });

    expect(finished).toMatchObject({ status: 'game_over', score: 1234 });
    expect(finished?.endedAt).toBeInstanceOf(Date);
  });
});
