import { HEALING_POTION_ID } from '@dragons-game/contracts';
import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import { vi } from 'vitest';

import * as gameRepository from '../../src/repositories/game-repository/index.ts';

const REWARD_BASE = 31;
const STARTING_LIVES = 3;

// A fake game behind the upstream repositories: one Sure thing per turn, each
// worth one more than the last (31, 32, ...), until a 410 after
// `turnsUntilGameOver` actions. A purchase succeeds when the game's own gold covers it,
// as upstream. Spies are restored by vi.restoreAllMocks().
export const scriptGame = ({ turnsUntilGameOver }: { turnsUntilGameOver: number }) => {
  const game = { gameId: '', turn: 0, score: 0, gold: 0, lives: STARTING_LIVES };
  let gameCounter = 0;
  const over = () => game.turn >= turnsUntilGameOver;
  const reward = () => REWARD_BASE + game.turn;

  return {
    startGame: vi.spyOn(gameRepository.mugloar, 'startGame').mockImplementation(() => {
      gameCounter += 1;
      Object.assign(game, {
        gameId: `bot-${gameCounter}`,
        turn: 0,
        score: 0,
        gold: 0,
        lives: STARTING_LIVES,
      });

      return Promise.resolve({
        gameId: game.gameId,
        lives: STARTING_LIVES,
        gold: 0,
        dragonLevel: 0,
        turn: 0,
        score: 0,
      });
    }),
    fetchAds: vi.spyOn(gameRepository.mugloar, 'findAds').mockImplementation(() =>
      Promise.resolve(
        over()
          ? { status: 'game_over' }
          : {
              status: 'ok',
              value: {
                droppedCount: 0,
                ads: [
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
            },
      ),
    ),
    solveAd: vi.spyOn(gameRepository.mugloar, 'solveAd').mockImplementation(() => {
      if (over()) {
        return Promise.resolve({ status: 'game_over' });
      }

      game.score += reward();
      game.gold += reward();
      game.turn += 1;

      return Promise.resolve({
        status: 'ok',
        value: { success: true, ...game, message: 'ok' },
      });
    }),
    fetchShop: vi
      .spyOn(gameRepository.mugloar, 'findShopItems')
      .mockResolvedValue({ status: 'ok', value: [...RECORDED_SHOP_ITEMS] }),
    buyItem: vi.spyOn(gameRepository.mugloar, 'buyItem').mockImplementation(({ itemId }) => {
      const item = RECORDED_SHOP_ITEMS.find(({ id }) => id === itemId);
      const isAffordable = item !== undefined && game.gold >= item.cost;

      game.turn += 1;

      if (isAffordable) {
        game.gold -= item.cost;
        game.lives += item.id === HEALING_POTION_ID ? 1 : 0;
      }

      return Promise.resolve({
        status: 'ok',
        value: {
          success: isAffordable,
          gold: game.gold,
          lives: game.lives,
          level: 0,
          turn: game.turn,
        },
      });
    }),
  };
};
