import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/entities/db-tables.ts';
import type { GameRun } from '../../src/entities/game-run.ts';
import { buyPlayerItem, solvePlayerAd, startGame } from '../../src/managers/game-manager/index.ts';
import { gameRunRepository, purchaseRepository } from '../../src/repositories/index.ts';
import { PLAYER_GAME_ID, SILENT_LOGGER, stubPlayerUpstream } from '../support/player-game.ts';

describe('player move records', () => {
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
    ({ run } = await startGame({ db, strategy: 'manual' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a player solve as player_choice', async () => {
    await solvePlayerAd({ db, gameId: PLAYER_GAME_ID, adId: 'sure1', logger: SILENT_LOGGER });

    expect(await db(DbTables.AdAttempts).first()).toMatchObject({ rule: 'player_choice' });
  });

  it('records a player purchase as player_choice with the item name', async () => {
    await gameRunRepository.db.updateOne({ db, id: run.id, patch: { gold: 60 } });
    vi.mocked(purchaseRepository.mugloar.createOne).mockResolvedValue({
      status: 'ok',
      value: { success: true, gold: 10, lives: 4, level: 0, turn: 1 },
    });

    await buyPlayerItem({ db, gameId: PLAYER_GAME_ID, itemId: 'hpot', logger: SILENT_LOGGER });

    expect(await db(DbTables.Purchases).first()).toMatchObject({
      rule: 'player_choice',
      item_name: 'Healing potion',
    });
  });
});
