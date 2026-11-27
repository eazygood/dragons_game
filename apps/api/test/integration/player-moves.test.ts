import type { GameState } from '@dragons-game/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STRATEGY_CONFIG } from '../../src/engine/strategy-config.ts';
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
  startGameRun,
} from '../../src/managers/game-manager/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import * as gameRepository from '../../src/repositories/game-repository/index.ts';
import { useMigratedDatabase } from '../support/integration-db.ts';
import {
  PLAYER_GAME_ID,
  SILENT_LOGGER,
  newGameState,
  solvedAdResponse,
  stubPlayerUpstream,
} from '../support/player-game.ts';

describe('player moves', () => {
  const db = useMigratedDatabase();
  let run: GameRun;
  let state: GameState;

  beforeEach(async () => {
    stubPlayerUpstream();
    ({ run, state } = await startGameRun({ db, strategy: 'manual' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('solves an ad on the board and records the advisor estimate', async () => {
    expect(
      await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT_LOGGER }),
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
    expect(Number(row.estimated_probability)).toBeCloseTo(
      STRATEGY_CONFIG.probabilityPrior['Sure thing'],
      4,
    );
  });

  it('rejects an ad that left the board without calling solve', async () => {
    await expect(
      solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'vanished', logger: SILENT_LOGGER }),
    ).rejects.toBeInstanceOf(AdExpiredError);
    expect(gameRepository.mugloar.solveAd).not.toHaveBeenCalled();
  });

  it('refuses a purchase the stored gold cannot cover, without burning a turn', async () => {
    await expect(
      buyPlayerItem({ db, gameId: PLAYER_GAME_ID, itemId: 'hpot', logger: SILENT_LOGGER }),
    ).rejects.toBeInstanceOf(InsufficientGoldError);
    expect(gameRepository.mugloar.buyItem).not.toHaveBeenCalled();
    expect(await gameRepository.db.findOne({ db, gameId: PLAYER_GAME_ID })).toMatchObject({
      turn: 0,
      gold: 0,
    });
  });

  it('buys an affordable item and reports the outcome', async () => {
    await gameRepository.db.updateOne({ db, id: run.id, patch: { gold: 60 } });
    vi.mocked(gameRepository.mugloar.buyItem).mockResolvedValue({
      status: 'ok',
      value: { success: true, gold: 10, lives: 4, level: 0, turn: 1 },
    });

    expect(
      await buyPlayerItem({ db, gameId: PLAYER_GAME_ID, itemId: 'hpot', logger: SILENT_LOGGER }),
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
      buyPlayerItem({ db, gameId: PLAYER_GAME_ID, itemId: 'nosuch', logger: SILENT_LOGGER }),
    ).rejects.toBeInstanceOf(ShopItemNotFoundError);
  });

  it('ends the run when a solve takes the last life', async () => {
    vi.mocked(gameRepository.mugloar.solveAd).mockResolvedValue(
      solvedAdResponse({ success: false, lives: 0, gold: 0, score: 0, message: 'defeated' }),
    );

    expect(
      await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT_LOGGER }),
    ).toMatchObject({ status: 'ok', value: { status: 'game_over' } });
    expect(await gameRepository.db.findOne({ db, gameId: PLAYER_GAME_ID })).toMatchObject({
      status: 'game_over',
      endedAt: expect.any(Date) as Date,
    });
  });

  it('answers a finished run with game over and no upstream call', async () => {
    await finishRun({ db, run, state, status: 'game_over' });
    vi.mocked(gameRepository.mugloar.findAds).mockClear();

    expect(
      await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT_LOGGER }),
    ).toEqual({
      status: 'game_over',
    });
    expect(gameRepository.mugloar.findAds).not.toHaveBeenCalled();
  });

  it('refuses to play a bot run', async () => {
    vi.mocked(gameRepository.mugloar.startGame).mockResolvedValue(newGameState('bot-game'));
    await startGameRun({ db, strategy: 'calibrated' });

    await expect(
      solvePlayerAd({ db, gameId: 'bot-game', adId: 'sure1', logger: SILENT_LOGGER }),
    ).rejects.toBeInstanceOf(GameNotPlayableError);
  });

  it('runs concurrent moves on one game one at a time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    vi.mocked(gameRepository.mugloar.solveAd).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return solvedAdResponse();
    });

    await Promise.all([
      solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT_LOGGER }),
      solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure2', logger: SILENT_LOGGER }),
    ]);

    expect(maxInFlight).toBe(1);
  });
});
