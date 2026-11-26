import { describe, expect, it, vi } from 'vitest';

import { DbTables } from '../../src/repositories/db-tables.ts';
import * as purchaseRepository from '../../src/repositories/purchase-repository.ts';
import * as mugloarRepository from '../../src/repositories/mugloar-repository.ts';
import {
  LEVEL_AFTER_PURCHASE,
  TURN_AFTER_PURCHASE,
  useManagedGame,
} from '../support/managed-game.ts';

describe('game manager purchases', () => {
  const { db, buyClawHoning, storedRun, countOf } = useManagedGame();

  it('raises the dragon level and writes the purchase row in one transaction', async () => {
    await buyClawHoning({ onPersistFailure: 'keep_playing' });

    expect(await storedRun()).toMatchObject({ dragonLevel: LEVEL_AFTER_PURCHASE });
    expect(await db(DbTables.Purchases).first()).toMatchObject({
      item_id: 'ch',
      item_name: 'Claw Honing',
      rule: 'level_up',
      success: 1,
    });
  });

  it('keep_playing: a failed purchase record rolls the level back, but the turn is still reported', async () => {
    vi.spyOn(purchaseRepository, 'createOne').mockRejectedValueOnce(new Error('insert failed'));

    const result = await buyClawHoning({ onPersistFailure: 'keep_playing' });

    expect(result).toMatchObject({
      status: 'ok',
      value: {
        persisted: false,
        turn: { state: { dragonLevel: LEVEL_AFTER_PURCHASE, turn: TURN_AFTER_PURCHASE } },
      },
    });
    expect(await storedRun()).toMatchObject({ dragonLevel: 0 });
    expect(await countOf({ table: DbTables.Purchases })).toEqual([{ count: 0 }]);
  });

  it('advances the turn but not the level when a purchase fails upstream', async () => {
    vi.mocked(mugloarRepository.buyItem).mockResolvedValue({
      status: 'ok',
      value: { success: false, gold: 10, lives: 3, level: 0, turn: 6 },
    });

    const result = await buyClawHoning({ onPersistFailure: 'keep_playing' });

    expect(result).toMatchObject({
      status: 'ok',
      value: { turn: { success: false, message: null, state: { turn: 6, dragonLevel: 0 } } },
    });
    expect(await db(DbTables.Purchases).first()).toMatchObject({
      item_id: 'ch',
      success: 0,
      turn: 6,
    });
  });
});
