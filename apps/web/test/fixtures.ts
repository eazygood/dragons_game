import { HEALING_POTION_ID } from '@dragons-game/contracts';
import type { AdVerdict, Decision, GameView, Move, MoveResult } from '@dragons-game/contracts';
import {
  SURE_AD_MESSAGE,
  buildAdvisedAd,
  buildTurnView,
} from '@dragons-game/contracts/test-support';

import type { MoveActions } from '../src/features/play/move-actions/move-actions.ts';

export { SURE_AD_MESSAGE, buildAdvisedAd };

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

export const TURN_VIEW = buildTurnView({ gameId: GAME_ID });

export const MOVE_MESSAGE = 'You successfully defended the village';

export const MOVE_RESULT: MoveResult = {
  game: { ...GAME_VIEW, state: { ...GAME_VIEW.state, gold: 30, score: 30, turn: 1 } },
  success: true,
  message: MOVE_MESSAGE,
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
