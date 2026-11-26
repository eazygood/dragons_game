import { afterEach, describe, expect, it, vi } from 'vitest';

import { findAds } from '../../src/managers/game-manager.ts';
import * as mugloarRepository from '../../src/repositories/mugloar-repository.ts';
import { PLAYER_BOARD, PLAYER_GAME_ID } from '../support/player-game.ts';

const LOGGER = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const boardWith = ({ droppedCount }: { droppedCount: number }) =>
  vi
    .spyOn(mugloarRepository, 'findAds')
    .mockResolvedValue({ status: 'ok', value: { ads: PLAYER_BOARD, droppedCount } });

afterEach(() => {
  vi.restoreAllMocks();
  LOGGER.warn.mockClear();
});

describe('findAds', () => {
  it('warns with the count when ads were dropped, and returns the playable ones', async () => {
    boardWith({ droppedCount: 2 });

    const boardResult = await findAds({ gameId: PLAYER_GAME_ID, logger: LOGGER });

    expect(boardResult).toEqual({ status: 'ok', value: PLAYER_BOARD });
    expect(LOGGER.warn).toHaveBeenCalledOnce();
    expect(LOGGER.warn).toHaveBeenCalledWith(
      { gameId: PLAYER_GAME_ID, droppedCount: 2 },
      expect.any(String),
    );
  });

  it('stays quiet when the whole board decoded', async () => {
    boardWith({ droppedCount: 0 });

    await findAds({ gameId: PLAYER_GAME_ID, logger: LOGGER });

    expect(LOGGER.warn).not.toHaveBeenCalled();
  });

  it('passes Game Over through untouched', async () => {
    vi.spyOn(mugloarRepository, 'findAds').mockResolvedValue({ status: 'game_over' });

    await expect(findAds({ gameId: PLAYER_GAME_ID, logger: LOGGER })).resolves.toEqual({
      status: 'game_over',
    });
    expect(LOGGER.warn).not.toHaveBeenCalled();
  });
});
