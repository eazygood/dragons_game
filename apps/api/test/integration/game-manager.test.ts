import type { GameState } from '@bigbank-dragon/contracts';
import { describe, expect, it, vi } from 'vitest';

import { finishRun } from '../../src/managers/game-manager/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import { adAttemptRepository } from '../../src/repositories/index.ts';
import { useManagedGame } from '../support/managed-game.ts';

describe('game manager', () => {
  const { db, current, solveTheAd, storedRun, countOf } = useManagedGame();

  it('persists a new run in its starting state', async () => {
    expect(await storedRun()).toMatchObject({
      lives: 3,
      gold: 0,
      dragonLevel: 0,
      turn: 0,
      score: 0,
      status: 'active',
      benchmarkId: null,
    });
  });

  it('returns the solve outcome with the new state, marked as persisted', async () => {
    expect(await solveTheAd()).toEqual({
      status: 'ok',
      value: {
        turn: {
          state: expect.objectContaining({ gold: 20, score: 20, turn: 1 }) as GameState,
          success: true,
          message: 'ok',
        },
        persisted: true,
      },
    });
  });

  it('writes an ad attempt carrying the prediction it acted on', async () => {
    await solveTheAd();

    expect(await db(DbTables.AdAttempts).first()).toMatchObject({
      ad_id: 'a1',
      probability: 'Quite likely',
      dragon_level: 0,
      estimated_probability: 0.8,
      expected_value: 12.5,
      rule: 'best_expected_value',
      success: 1,
    });
    expect(await storedRun()).toMatchObject({ gold: 20, score: 20, turn: 1 });
  });

  it('reports game over from the manager rather than throwing', async () => {
    vi.mocked(adAttemptRepository.mugloar.createOne).mockResolvedValue({ status: 'game_over' });

    await expect(solveTheAd()).resolves.toEqual({ status: 'game_over' });
    expect(await countOf({ table: DbTables.AdAttempts })).toEqual([{ count: 0 }]);
  });

  it('closes a run when it finishes', async () => {
    const { run, state } = current();

    await finishRun({ db, run, state: { ...state, score: 1234 }, status: 'game_over' });

    const finished = await storedRun();

    expect(finished).toMatchObject({ status: 'game_over', score: 1234 });
    expect(finished?.endedAt).toBeInstanceOf(Date);
  });
});
