import { RECORDED_SHOP_ITEMS } from '@bigbank-dragon/contracts/test-support';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { priorCalibration } from '../../src/domain/engine/calibration.ts';
import { decide } from '../../src/domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import type { GameRun } from '../../src/entities/game-run.ts';
import { adviseTurn } from '../../src/managers/advisor-manager/index.ts';
import { startGameRun, stateFromRun } from '../../src/managers/game-manager/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import {
  PLAYER_BOARD,
  PLAYER_GAME_ID,
  SILENT_LOGGER,
  stubPlayerUpstream,
} from '../support/player-game.ts';

describe('turn advice', () => {
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

  it('advises exactly what decide() would do', async () => {
    const turn = await adviseTurn({ db, gameId: PLAYER_GAME_ID, logger: SILENT_LOGGER });
    const calibration = priorCalibration({ config: STRATEGY_CONFIG });
    const expected = decide({
      state: stateFromRun({ run }),
      board: PLAYER_BOARD,
      shop: [...RECORDED_SHOP_ITEMS],
      calibration,
      config: STRATEGY_CONFIG,
    });

    expect(turn).toMatchObject({ status: 'ok', value: { recommendation: expected } });
  });
});
