import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';

type IndexRow = { Key_name: string; Column_name: string };

describe('core schema migration', () => {
  let db: Knex;

  beforeAll(async () => {
    db = createDatabase({ config: loadConfig({ env: process.env }) });
    await db.migrate.rollback(undefined, true);
  });

  afterAll(async () => {
    await db.migrate.latest();
    await db.destroy();
  });

  it('creates the three tables from scratch', async () => {
    await db.migrate.latest();

    for (const table of Object.values(DbTables)) {
      expect(await db.schema.hasTable(table)).toBe(true);
    }
  });

  it('indexes ad_attempts on the calibration lookup key', async () => {
    const [indexes] = (await db.raw('SHOW INDEX FROM ad_attempts')) as [IndexRow[]];
    const calibrationKey = indexes.filter(
      (row) => row.Key_name === 'ad_attempts_probability_dragon_level_index',
    );

    expect(calibrationKey.map((row) => row.Column_name)).toEqual(['probability', 'dragon_level']);
  });

  it('cascades a run delete to its attempts and purchases', async () => {
    const [gameRunId] = await db(DbTables.GameRuns).insert({
      game_id: 'cascade',
      strategy: 'baseline',
      lives: 3,
      gold: 0,
      dragon_level: 0,
      turn: 0,
      score: 0,
      status: 'active',
      started_at: new Date(),
    });

    await db(DbTables.AdAttempts).insert({
      game_run_id: gameRunId,
      ad_id: 'ad',
      probability: 'Gamble',
      dragon_level: 0,
      turn: 1,
      reward: 10,
      success: true,
      estimated_probability: 0.5,
      expected_value: 5,
      created_at: new Date(),
    });
    await db(DbTables.Purchases).insert({
      game_run_id: gameRunId,
      item_id: 'hpot',
      cost: 50,
      turn: 1,
      success: false,
      created_at: new Date(),
    });
    await db(DbTables.GameRuns).where({ id: gameRunId }).delete();

    expect(await db(DbTables.AdAttempts).where({ game_run_id: gameRunId })).toEqual([]);
    expect(await db(DbTables.Purchases).where({ game_run_id: gameRunId })).toEqual([]);
  });

  it('adds a nullable rule to moves and the item name to purchases', async () => {
    const attemptColumns = await db(DbTables.AdAttempts).columnInfo();
    const purchaseColumns = await db(DbTables.Purchases).columnInfo();

    expect(attemptColumns.rule).toMatchObject({ nullable: true });
    expect(purchaseColumns.rule).toMatchObject({ nullable: true });
    expect(purchaseColumns.item_name).toMatchObject({ nullable: true });

    await db.migrate.down({ name: '20261124000002_add_move_rule.ts' });

    expect(Object.keys(await db(DbTables.AdAttempts).columnInfo())).not.toContain('rule');
    expect(Object.keys(await db(DbTables.Purchases).columnInfo())).not.toContain('rule');
    expect(Object.keys(await db(DbTables.Purchases).columnInfo())).not.toContain('item_name');

    await db.migrate.latest();
  });

  it('allows one run per game id, and only until rolled back', async () => {
    const run = { strategy: 'baseline', lives: 3, gold: 0, dragon_level: 0, turn: 0, score: 0 };
    const insertRun = () =>
      db(DbTables.GameRuns).insert({ ...run, game_id: 'twice', started_at: new Date() });

    await insertRun();
    await expect(insertRun()).rejects.toThrow(/Duplicate entry/);

    await db.migrate.down({ name: '20261125000001_unique_game_id.ts' });
    await expect(insertRun()).resolves.toBeDefined();

    await db(DbTables.GameRuns).where({ game_id: 'twice' }).delete();
    await db.migrate.latest();
  });

  it('rolls back cleanly', async () => {
    await db.migrate.rollback(undefined, true);

    expect(await db.schema.hasTable(DbTables.GameRuns)).toBe(false);
  });
});
