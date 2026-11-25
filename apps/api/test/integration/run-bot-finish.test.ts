import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { runBot } from '../../src/bot/run-bot.ts';
import { loadConfig } from '../../src/config/index.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import { DbTables } from '../../src/entities/db-tables.ts';
import { gameRunRepository } from '../../src/repositories/index.ts';
import { scriptGame } from '../support/scripted-game.ts';

// Below the scripted game's starting lives, so the engine solves every turn.
const config = { ...STRATEGY_CONFIG, livesFloor: 2 };
const SCRIPTED_TURNS = 3;

const logger = { info: vi.fn(), warn: vi.fn() };

describe('runBot when the final run write fails', () => {
  let db: Knex;

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(() => db.destroy());

  beforeEach(async () => {
    await db(DbTables.GameRuns).delete();
    scriptGame({ turnsUntilGameOver: SCRIPTED_TURNS });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.warn.mockClear();
  });

  it('still reports the finished game and logs the unrecorded finish', async () => {
    const realUpdateOne = gameRunRepository.db.updateOne;

    // Per-turn state writes pass through; only the write that sets the final status fails.
    vi.spyOn(gameRunRepository.db, 'updateOne').mockImplementation((input) =>
      input.patch.status === undefined
        ? realUpdateOne(input)
        : Promise.reject(new Error('db went away')),
    );

    const result = await runBot({ db, strategy: 'calibrated', config, logger });

    expect(result.turns).toBe(SCRIPTED_TURNS);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: result.gameId }),
      'finished run not finalised',
    );
    expect(await gameRunRepository.db.findOne({ db, gameId: result.gameId })).toMatchObject({
      status: 'active',
    });
  });
});
