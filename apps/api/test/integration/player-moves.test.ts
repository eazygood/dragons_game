import { PROBABILITY_PRIOR } from '@bigbank-dragon/contracts';
import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/entities/db-tables.ts';
import type { GameRun } from '../../src/entities/game-run.ts';
import {
  AdExpiredError,
  GameNotPlayableError,
  InsufficientGoldError,
  ShopItemNotFoundError,
} from '../../src/errors/errors.ts';
import {
  buyPlayerItem,
  finishRun,
  solvePlayerAd,
  startGame,
} from '../../src/managers/game-manager/index.ts';
import {
  adAttemptRepository,
  adRepository,
  gameRunRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';
import {
  PLAYER_GAME_ID,
  SILENT,
  snapshot,
  solved,
  stubPlayerUpstream,
} from '../support/player-game.ts';

describe('player moves', () => {
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
    stubPlayerUpstream();
    ({ run, state } = await startGame({ db, strategy: 'manual' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('solves an ad on the board and records the advisor estimate', async () => {
    expect(
      await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT }),
    ).toEqual({
      status: 'ok',
      value: {
        state: expect.objectContaining({ gold: 30, score: 30, turn: 1 }) as GameState,
        status: 'active',
        success: true,
        message: 'You did it',
      },
    });

    const row = (await db(DbTables.AdAttempts).first()) as Record<string, unknown>;

    expect(row).toMatchObject({ ad_id: 'sure1', probability: 'Sure thing', success: 1 });
    expect(Number(row.estimated_probability)).toBeCloseTo(PROBABILITY_PRIOR['Sure thing'], 4);
  });

  // Review Focus #2
  it('rejects an ad that left the board without calling solve', async () => {
    await expect(
      solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'vanished', logger: SILENT }),
    ).rejects.toBeInstanceOf(AdExpiredError);
    expect(adAttemptRepository.mugloar.createOne).not.toHaveBeenCalled();
  });

  // Review Focus #3
  it('refuses a purchase the stored gold cannot cover, without burning a turn', async () => {
    await expect(
      buyPlayerItem({ db, gameId: PLAYER_GAME_ID, itemId: 'hpot', logger: SILENT }),
    ).rejects.toBeInstanceOf(InsufficientGoldError);
    expect(purchaseRepository.mugloar.createOne).not.toHaveBeenCalled();
    expect(await gameRunRepository.db.findOne({ db, gameId: PLAYER_GAME_ID })).toMatchObject({
      turn: 0,
      gold: 0,
    });
  });

  it('buys an affordable item and reports the outcome', async () => {
    await gameRunRepository.db.updateOne({ db, id: run.id, patch: { gold: 60 } });
    vi.mocked(purchaseRepository.mugloar.createOne).mockResolvedValue({
      status: 'ok',
      value: { success: true, gold: 10, lives: 4, level: 0, turn: 1 },
    });

    expect(
      await buyPlayerItem({ db, gameId: PLAYER_GAME_ID, itemId: 'hpot', logger: SILENT }),
    ).toEqual({
      status: 'ok',
      value: {
        state: expect.objectContaining({ gold: 10, lives: 4, turn: 1 }) as GameState,
        status: 'active',
        success: true,
        message: null,
      },
    });
  });

  it('rejects an item the shop does not list', async () => {
    await expect(
      buyPlayerItem({ db, gameId: PLAYER_GAME_ID, itemId: 'nosuch', logger: SILENT }),
    ).rejects.toBeInstanceOf(ShopItemNotFoundError);
  });

  // Review Focus #5
  it('ends the run when a solve takes the last life', async () => {
    vi.mocked(adAttemptRepository.mugloar.createOne).mockResolvedValue(
      solved({ success: false, lives: 0, gold: 0, score: 0, message: 'defeated' }),
    );

    expect(
      await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT }),
    ).toMatchObject({ status: 'ok', value: { status: 'game_over' } });
    expect(await gameRunRepository.db.findOne({ db, gameId: PLAYER_GAME_ID })).toMatchObject({
      status: 'game_over',
      endedAt: expect.any(Date) as Date,
    });
  });

  it('answers a finished run with game over and no upstream call', async () => {
    await finishRun({ db, run, state, status: 'game_over' });
    vi.mocked(adRepository.mugloar.findMany).mockClear();

    expect(
      await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT }),
    ).toEqual({
      status: 'game_over',
    });
    expect(adRepository.mugloar.findMany).not.toHaveBeenCalled();
  });

  it('refuses to play a bot run', async () => {
    vi.mocked(gameRunRepository.mugloar.createOne).mockResolvedValue(snapshot('bot-game'));
    await startGame({ db, strategy: 'calibrated' });

    await expect(
      solvePlayerAd({ db, gameId: 'bot-game', adId: 'sure1', logger: SILENT }),
    ).rejects.toBeInstanceOf(GameNotPlayableError);
  });

  // Review Focus #1 (server half)
  it('runs concurrent moves on one game one at a time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    vi.mocked(adAttemptRepository.mugloar.createOne).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return solved();
    });

    await Promise.all([
      solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT }),
      solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure2', logger: SILENT }),
    ]);

    expect(maxInFlight).toBe(1);
  });

  it('keeps the upstream state when the turn cannot be persisted', async () => {
    vi.spyOn(gameRunRepository.db, 'updateOne').mockRejectedValue(new Error('db down'));

    expect(
      await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT }),
    ).toMatchObject({ status: 'ok', value: { state: { score: 30 } } });
  });
});
