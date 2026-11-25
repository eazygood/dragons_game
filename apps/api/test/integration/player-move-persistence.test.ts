import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import type { GameRun } from '../../src/entities/game-run.ts';
import { PersistenceFailedError } from '../../src/errors/errors.ts';
import {
  buyPlayerItem,
  solvePlayerAd,
  startGameRun,
} from '../../src/managers/game-manager/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import {
  adAttemptRepository,
  gameRunRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';
import { PLAYER_GAME_ID, SILENT_LOGGER, stubPlayerUpstream } from '../support/player-game.ts';

describe('player move persistence when a write fails', () => {
  let db: Knex;
  let run: GameRun;

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(() => db.destroy());

  beforeEach(async () => {
    await db(DbTables.GameRuns).delete();
    stubPlayerUpstream();
    ({ run } = await startGameRun({ db, strategy: 'manual' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The next move rebuilds state from the row, so a lost record must not lose the state too.
  it('saves the state alone when a solve record cannot be written', async () => {
    vi.spyOn(adAttemptRepository.db, 'createOne').mockRejectedValue(new Error('insert failed'));

    expect(
      await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT_LOGGER }),
    ).toMatchObject({ status: 'ok', value: { state: { score: 30 } } });
    expect(await gameRunRepository.db.findOne({ db, gameId: PLAYER_GAME_ID })).toMatchObject({
      score: 30,
      turn: 1,
    });
  });

  it('keeps the bought dragon level when the purchase record cannot be written', async () => {
    await gameRunRepository.db.updateOne({ db, id: run.id, patch: { gold: 300 } });
    vi.mocked(purchaseRepository.mugloar.createOne).mockResolvedValue({
      status: 'ok',
      value: { success: true, gold: 200, lives: 3, level: 1, turn: 1 },
    });
    vi.spyOn(purchaseRepository.db, 'createOne').mockRejectedValue(new Error('insert failed'));

    await buyPlayerItem({ db, gameId: PLAYER_GAME_ID, itemId: 'hpot', logger: SILENT_LOGGER });

    expect(await gameRunRepository.db.findOne({ db, gameId: PLAYER_GAME_ID })).toMatchObject({
      dragonLevel: 1,
      gold: 200,
    });
  });

  it('fails the move rather than claim it was saved when the state cannot be written', async () => {
    vi.spyOn(gameRunRepository.db, 'updateOne').mockRejectedValue(new Error('db down'));

    await expect(
      solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT_LOGGER }),
    ).rejects.toBeInstanceOf(PersistenceFailedError);
  });
});
