import { SHOP_ITEM_PRIOR } from '@bigbank-dragon/contracts';
import type { AdvisedAd, GameView, MoveResult, TurnView } from '@bigbank-dragon/contracts';

export const GAME_ID = 'g1';

export const GAME_VIEW: GameView = {
  state: { gameId: GAME_ID, lives: 3, gold: 0, dragonLevel: 0, turn: 0, score: 0 },
  status: 'active',
};

export const buildAdvisedAd = (overrides: Partial<AdvisedAd> = {}): AdvisedAd => ({
  adId: 'sure1',
  message: 'Help defend the village',
  reward: 30,
  expiresIn: 5,
  probability: 'Sure thing',
  wasEncrypted: false,
  advice: { verdict: 'recommended', estimatedProbability: 0.95, expectedValue: 25 },
  ...overrides,
});

export const TURN_VIEW: TurnView = {
  game: GAME_VIEW,
  board: [
    buildAdvisedAd(),
    buildAdvisedAd({
      adId: 'risky1',
      probability: 'Risky',
      reward: 60,
      advice: { verdict: 'long_shot', estimatedProbability: 0.4, expectedValue: -18 },
    }),
  ],
  shop: [...SHOP_ITEM_PRIOR],
  recommendation: {
    kind: 'solve',
    adId: 'sure1',
    reasoning: {
      rule: 'best_expected_value',
      estimatedProbability: 0.95,
      expectedValue: 25,
      consideredCount: 2,
    },
  },
};

export const MOVE_RESULT: MoveResult = {
  game: { ...GAME_VIEW, state: { ...GAME_VIEW.state, gold: 30, score: 30, turn: 1 } },
  success: true,
  message: 'You successfully defended the village',
};
