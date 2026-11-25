import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/entities/db-tables.ts';

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

  it('keeps live state on game_runs and no duplicated finals', async () => {
    const columns = Object.keys(await db(DbTables.GameRuns).columnInfo());

    expect(columns).toEqual(
      expect.arrayContaining([
        'game_id',
        'strategy',
        'benchmark_id',
        'lives',
        'gold',
        'dragon_level',
        'turn',
        'score',
        'status',
        'started_at',
        'ended_at',
      ]),
    );
    expect(columns).not.toContain('final_score');
    expect(columns).not.toContain('final_turn');
    expect(columns).not.toContain('mode');
  });

  // Phase 1 measured no effect (0.73 encrypted vs 0.72 plaintext), so it went.
  it('does not carry the disproven was_encrypted hypothesis', async () => {
    const columns = Object.keys(await db(DbTables.AdAttempts).columnInfo());

    expect(columns).toContain('reward');
    expect(columns).not.toContain('was_encrypted');
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

    await db(DbTables.Purchases).insert({
      game_run_id: gameRunId,
      item_id: 'hpot',
      cost: 50,
      turn: 1,
      success: false,
      created_at: new Date(),
    });
    await db(DbTables.GameRuns).where({ id: gameRunId }).delete();

    expect(await db(DbTables.Purchases).where({ game_run_id: gameRunId })).toEqual([]);
  });

  it('adds a nullable rule to moves and the item name to purchases', async () => {
    const attemptColumns = await db(DbTables.AdAttempts).columnInfo();
    const purchaseColumns = await db(DbTables.Purchases).columnInfo();

    expect(attemptColumns.rule).toMatchObject({ nullable: true });
    expect(purchaseColumns.rule).toMatchObject({ nullable: true });
    expect(purchaseColumns.item_name).toMatchObject({ nullable: true });

    await db.migrate.down();

    expect(Object.keys(await db(DbTables.AdAttempts).columnInfo())).not.toContain('rule');
    expect(Object.keys(await db(DbTables.Purchases).columnInfo())).not.toContain('rule');
    expect(Object.keys(await db(DbTables.Purchases).columnInfo())).not.toContain('item_name');

    await db.migrate.latest();
  });

  it('rolls back cleanly', async () => {
    await db.migrate.rollback(undefined, true);

    expect(await db.schema.hasTable(DbTables.GameRuns)).toBe(false);
  });
});
