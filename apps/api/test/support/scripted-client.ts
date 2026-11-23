import { SHOP_ITEM_PRIOR } from '@bigbank-dragon/contracts';
import { vi } from 'vitest';

import type { MugloarClient } from '../../src/adapters/mugloar-api-adapter/index.ts';

const REWARD_BASE = 31;
const STARTING_LIVES = 3;

let gameCounter = 0;

// A fake game: one Sure thing per turn, each worth one more than the last
// (31, 32, ...), until a 410 after `turnsUntilGameOver` actions.
export const createScriptedClient = ({ turnsUntilGameOver }: { turnsUntilGameOver: number }) => {
  const game = { gameId: '', turn: 0, score: 0, gold: 0 };
  const over = () => game.turn >= turnsUntilGameOver;
  const reward = () => REWARD_BASE + game.turn;

  return {
    startGame: vi.fn<MugloarClient['startGame']>(() => {
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
    fetchAds: vi.fn<MugloarClient['fetchAds']>(() =>
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
    solveAd: vi.fn<MugloarClient['solveAd']>(() => {
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
    fetchShop: vi.fn<MugloarClient['fetchShop']>(() =>
      Promise.resolve({ status: 'ok', value: [...SHOP_ITEM_PRIOR] }),
    ),
    buyItem: vi.fn<MugloarClient['buyItem']>(() => {
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
  } satisfies MugloarClient;
};
