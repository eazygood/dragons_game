import { HEALING_POTION_ID } from '@bigbank-dragon/contracts';
import type {
  AdVerdict,
  AdvisedAd,
  Decision,
  GameView,
  Move,
  MoveResult,
  TurnView,
} from '@bigbank-dragon/contracts';
import { RECORDED_SHOP_ITEMS } from '@bigbank-dragon/contracts/test-support';

import type { MoveActions } from '../src/features/play/move-actions/move-actions.ts';

export const GAME_ID = 'g1';
export const GAME_ROUTE = 'GET /api/games/g1';
export const MOVES_ROUTE = 'GET /api/games/g1/moves';
export const SHOW_MOVES = 'Show moves';
export const INTERVALS_AFTER_FINISH = 5;
export const ABOVE_TARGET = 1240;

export const GAME_VIEW: GameView = {
  state: { gameId: GAME_ID, lives: 3, gold: 0, dragonLevel: 0, turn: 0, score: 0 },
  status: 'active',
};

export const buildGameView = ({
  status,
  score,
}: {
  status: GameView['status'];
  score: number;
}): GameView => ({ state: { ...GAME_VIEW.state, score }, status });

export const SOLVE_MOVE = {
  kind: 'solve',
  turn: 4,
  success: true,
  probability: 'Sure thing',
  reward: 30,
  estimatedProbability: 0.95,
  expectedValue: 25,
  rule: 'best_expected_value',
} satisfies Move;

export const BUY_MOVE = {
  kind: 'buy',
  turn: 3,
  success: false,
  itemName: 'Healing potion',
  cost: 50,
  rule: 'survival_floor',
} satisfies Move;

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
      message: 'Escort the merchant through the swamp',
      probability: 'Risky',
      reward: 60,
      advice: { verdict: 'long_shot', estimatedProbability: 0.4, expectedValue: -18 },
    }),
  ],
  shop: [...RECORDED_SHOP_ITEMS],
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

export const IDLE_MOVE_ACTIONS: MoveActions = {
  solve: () => undefined,
  buy: () => undefined,
  isPending: false,
};

export const BUY_POTION: Decision = {
  kind: 'buy',
  itemId: HEALING_POTION_ID,
  reasoning: {
    rule: 'survival_floor',
    estimatedProbability: null,
    expectedValue: null,
    consideredCount: 9,
  },
};

export const STOP: Decision = {
  kind: 'stop',
  reasoning: {
    rule: 'no_viable_option',
    estimatedProbability: null,
    expectedValue: null,
    consideredCount: 0,
  },
};

export const withVerdict = ({ verdict }: { verdict: AdVerdict }) =>
  buildAdvisedAd({ advice: { verdict, estimatedProbability: 0.5, expectedValue: 5 } });
