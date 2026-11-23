import type { Ad, GameState, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MugloarClient } from '../../src/adapters/mugloar-api-adapter/index.ts';
import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/entities/db-tables.ts';
import type { GameRun } from '../../src/entities/game-run.ts';
import { PersistenceFailedError } from '../../src/errors/errors.ts';
import { buyItem, finishRun, solveAd, startGame } from '../../src/managers/game-manager/index.ts';
import { gameRunRepository, purchaseRepository } from '../../src/repositories/index.ts';

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

const stubClient = {
  startGame: vi.fn<MugloarClient['startGame']>(),
  fetchAds: vi.fn<MugloarClient['fetchAds']>(),
  solveAd: vi.fn<MugloarClient['solveAd']>(),
  fetchShop: vi.fn<MugloarClient['fetchShop']>(),
  buyItem: vi.fn<MugloarClient['buyItem']>(),
} satisfies MugloarClient;

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
    stubClient.startGame.mockResolvedValue({
      gameId: 'mgr-game',
      lives: 3,
      gold: 0,
      level: 0,
      score: 0,
      highScore: 0,
      turn: 0,
    });
    stubClient.solveAd.mockResolvedValue({
      status: 'ok',
      value: { success: true, lives: 3, gold: 20, score: 20, highScore: 0, turn: 1, message: 'ok' },
    });
    stubClient.buyItem.mockResolvedValue({
      status: 'ok',
      value: { shoppingSuccess: true, gold: 0, lives: 3, level: 2, turn: 5 },
    });

    ({ run, state } = await startGame({ db, client: stubClient, strategy: 'calibrated' }));
    state = { ...state, gold: 300, turn: 4 };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists a new run in its starting state', async () => {
    expect(await gameRunRepository.findOne({ db, gameId: run.gameId })).toMatchObject({
      lives: 3,
      gold: 0,
      dragonLevel: 0,
      turn: 0,
      score: 0,
      status: 'active',
      benchmarkId: null,
    });
  });

  it('writes an ad attempt carrying the prediction it acted on', async () => {
    await solveAd({ db, client: stubClient, run, state, ad: AD, reasoning: REASONING });

    expect(await db(DbTables.AdAttempts).first()).toMatchObject({
      ad_id: 'a1',
      probability: 'Quite likely',
      dragon_level: 0,
      estimated_probability: 0.8,
      expected_value: 12.5,
      success: 1,
    });
    expect(await gameRunRepository.findOne({ db, gameId: run.gameId })).toMatchObject({
      gold: 20,
      score: 20,
      turn: 1,
    });
  });

  it('raises the dragon level and the purchase row in one transaction', async () => {
    await buyItem({ db, client: stubClient, run, state, item: CLAW_HONING });

    expect(await gameRunRepository.findOne({ db, gameId: run.gameId })).toMatchObject({
      dragonLevel: 2,
    });
    expect(await db(DbTables.Purchases).first()).toMatchObject({ item_id: 'ch', success: 1 });
  });

  it('leaves no purchase row and no level change when the transaction fails', async () => {
    vi.spyOn(purchaseRepository, 'createOne').mockRejectedValueOnce(new Error('insert failed'));

    const attempt = buyItem({ db, client: stubClient, run, state, item: CLAW_HONING });

    await expect(attempt).rejects.toBeInstanceOf(PersistenceFailedError);
    await expect(attempt).rejects.toMatchObject({ state: { dragonLevel: 2, turn: 5 } });
    expect(await gameRunRepository.findOne({ db, gameId: run.gameId })).toMatchObject({
      dragonLevel: 0,
    });
    expect(await db(DbTables.Purchases).count({ count: '*' })).toEqual([{ count: 0 }]);
  });

  // Review Focus #4
  it('advances the turn but not the level when a purchase fails', async () => {
    stubClient.buyItem.mockResolvedValue({
      status: 'ok',
      value: { shoppingSuccess: false, gold: 10, lives: 3, level: 0, turn: 6 },
    });

    const result = await buyItem({ db, client: stubClient, run, state, item: CLAW_HONING });

    expect(result).toMatchObject({ status: 'ok', value: { turn: 6, dragonLevel: 0 } });
    expect(await db(DbTables.Purchases).first()).toMatchObject({
      item_id: 'ch',
      success: 0,
      turn: 6,
    });
  });

  it('reports game over from the manager rather than throwing', async () => {
    stubClient.solveAd.mockResolvedValue({ status: 'game_over' });

    await expect(
      solveAd({ db, client: stubClient, run, state, ad: AD, reasoning: REASONING }),
    ).resolves.toEqual({ status: 'game_over' });
    expect(await db(DbTables.AdAttempts).count({ count: '*' })).toEqual([{ count: 0 }]);
  });

  it('closes a run when it finishes', async () => {
    await finishRun({ db, run, state: { ...state, score: 1234 } });

    const finished = await gameRunRepository.findOne({ db, gameId: run.gameId });

    expect(finished).toMatchObject({ status: 'game_over', score: 1234 });
    expect(finished?.endedAt).toBeInstanceOf(Date);
  });
});
