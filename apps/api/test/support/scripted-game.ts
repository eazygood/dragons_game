import { SHOP_ITEM_PRIOR } from '@bigbank-dragon/contracts';
import { vi } from 'vitest';

import {
  adAttemptRepository,
  adRepository,
  gameRunRepository,
  purchaseRepository,
  shopItemRepository,
} from '../../src/repositories/index.ts';

const REWARD_BASE = 31;
const STARTING_LIVES = 3;

let gameCounter = 0;

// A fake game behind the upstream repositories: one Sure thing per turn, each
// worth one more than the last (31, 32, ...), until a 410 after
// `turnsUntilGameOver` actions. Spies are restored by vi.restoreAllMocks().
export const scriptGame = ({ turnsUntilGameOver }: { turnsUntilGameOver: number }) => {
  const game = { gameId: '', turn: 0, score: 0, gold: 0 };
  const over = () => game.turn >= turnsUntilGameOver;
  const reward = () => REWARD_BASE + game.turn;

  return {
    startGame: vi.spyOn(gameRunRepository.mugloar, 'createOne').mockImplementation(() => {
      gameCounter += 1;
      Object.assign(game, { gameId: `bot-${gameCounter}`, turn: 0, score: 0, gold: 0 });

      return Promise.resolve({
        gameId: game.gameId,
        lives: STARTING_LIVES,
        gold: 0,
        level: 0,
        score: 0,
        highScore: 0,
        turn: 0,
      });
    }),
    fetchAds: vi.spyOn(adRepository.mugloar, 'findMany').mockImplementation(() =>
      Promise.resolve(
        over()
          ? { status: 'game_over' }
          : {
              status: 'ok',
              value: [
                {
                  adId: `ad-${game.turn}`,
                  message: 'Escort a wagon',
                  reward: reward(),
                  expiresIn: 5,
                  probability: 'Sure thing',
                  wasEncrypted: false,
                },
              ],
            },
      ),
    ),
    solveAd: vi.spyOn(adAttemptRepository.mugloar, 'createOne').mockImplementation(() => {
      if (over()) {
        return Promise.resolve({ status: 'game_over' });
      }

      game.score += reward();
      game.gold += reward();
      game.turn += 1;

      return Promise.resolve({
        status: 'ok',
        value: { success: true, lives: STARTING_LIVES, ...game, highScore: 0, message: 'ok' },
      });
    }),
    fetchShop: vi
      .spyOn(shopItemRepository.mugloar, 'findMany')
      .mockResolvedValue({ status: 'ok', value: [...SHOP_ITEM_PRIOR] }),
    buyItem: vi.spyOn(purchaseRepository.mugloar, 'createOne').mockImplementation(() => {
      game.turn += 1;

      return Promise.resolve({
        status: 'ok',
        value: {
          shoppingSuccess: false,
          gold: game.gold,
          lives: STARTING_LIVES,
          level: 0,
          turn: game.turn,
        },
      });
    }),
  };
};
