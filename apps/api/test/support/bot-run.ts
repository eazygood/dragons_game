import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { scriptGame } from './scripted-game.ts';

// Below the scripted game's starting lives, so the engine solves every turn.
export const BOT_CONFIG = { ...STRATEGY_CONFIG, livesFloor: 2 };
export const SCRIPTED_TURNS = 12;
// Rewards 31..42 over twelve successful turns.
export const SCRIPTED_SCORE = 438;

export const botLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

type BotRunHarness = { db: Knex; scriptedGame: ReturnType<typeof scriptGame> };

// Registers the hooks of a runBot suite: a migrated database emptied before each
// test, and a freshly scripted game behind the upstream repositories.
export const useBotRunHarness = (): BotRunHarness => {
  const harness = {} as BotRunHarness;

  beforeAll(async () => {
    harness.db = createDatabase({ config: loadConfig({ env: process.env }) });
    await harness.db.migrate.rollback(undefined, true);
    await harness.db.migrate.latest();
  });

  afterAll(() => harness.db.destroy());

  beforeEach(async () => {
    await harness.db(DbTables.GameRuns).delete();
    harness.scriptedGame = scriptGame({ turnsUntilGameOver: SCRIPTED_TURNS });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    botLogger.info.mockClear();
    botLogger.warn.mockClear();
    botLogger.error.mockClear();
  });

  return harness;
};
