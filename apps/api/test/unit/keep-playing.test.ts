import { describe, expect, it, vi } from 'vitest';

import { AdExpiredError, PersistenceFailedError } from '../../src/errors/errors.ts';
import { keepPlayingOnPersistenceFailure } from '../../src/managers/game-manager/keep-playing.ts';

const STATE = { gameId: 'g1', lives: 3, gold: 30, dragonLevel: 0, turn: 1, score: 30 };
const SILENT = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('keepPlayingOnPersistenceFailure', () => {
  it('plays on with the upstream result when persistence fails', async () => {
    const turnResult = { state: STATE, success: true, message: 'ok' };
    const warn = vi.fn();
    const pendingTurn = Promise.reject(
      new PersistenceFailedError({ message: 'db down', turnResult }),
    );

    await expect(
      keepPlayingOnPersistenceFailure({
        pendingTurn,
        logger: { info: vi.fn(), warn, error: vi.fn() },
      }),
    ).resolves.toEqual({ status: 'ok', value: turnResult });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('rethrows anything else', async () => {
    const pendingTurn = Promise.reject(new AdExpiredError({ message: 'x' }));

    await expect(
      keepPlayingOnPersistenceFailure({ pendingTurn, logger: SILENT }),
    ).rejects.toBeInstanceOf(AdExpiredError);
  });
});
