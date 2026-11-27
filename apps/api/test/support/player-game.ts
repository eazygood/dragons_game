import type { Ad, GameState } from '@dragons-game/contracts';
import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import { vi } from 'vitest';

import * as gameRepository from '../../src/repositories/game-repository/index.ts';

export const SILENT_LOGGER = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
export const PLAYER_GAME_ID = 'player-game';

const buildAd = (overrides: Partial<Ad>): Ad => ({
  adId: 'sure1',
  message: 'Help someone',
  reward: 30,
  expiresIn: 5,
  probability: 'Sure thing',
  wasEncrypted: false,
  ...overrides,
});

export const PLAYER_BOARD = [
  buildAd({}),
  buildAd({ adId: 'sure2' }),
  buildAd({ adId: 'imp', probability: 'Impossible', reward: 200 }),
];

// What the upstream's /game/start answers, for tests that stub the HTTP call.
export const newGameStartBody = (gameId: string) => ({
  gameId,
  lives: 3,
  gold: 0,
  level: 0,
  score: 0,
  highScore: 0,
  turn: 0,
});

// What the repository's startGame returns, for tests that stub the repository.
export const newGameState = (gameId: string): GameState => ({
  gameId,
  lives: 3,
  gold: 0,
  dragonLevel: 0,
  turn: 0,
  score: 0,
});

export const solvedAdResponse = (overrides: object = {}) => ({
  status: 'ok' as const,
  value: {
    success: true,
    lives: 3,
    gold: 30,
    score: 30,
    turn: 1,
    message: 'You did it',
    ...overrides,
  },
});

// Every upstream call a player move can make, answered as a fresh game would.
export const stubPlayerUpstream = () => {
  vi.spyOn(gameRepository.mugloar, 'startGame').mockResolvedValue(newGameState(PLAYER_GAME_ID));
  vi.spyOn(gameRepository.mugloar, 'findAds').mockResolvedValue({
    status: 'ok',
    value: { ads: PLAYER_BOARD, droppedCount: 0 },
  });
  vi.spyOn(gameRepository.mugloar, 'findShopItems').mockResolvedValue({
    status: 'ok',
    value: [...RECORDED_SHOP_ITEMS],
  });
  vi.spyOn(gameRepository.mugloar, 'solveAd').mockResolvedValue(solvedAdResponse());
  vi.spyOn(gameRepository.mugloar, 'buyItem');
};
