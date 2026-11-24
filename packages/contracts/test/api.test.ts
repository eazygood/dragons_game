import { describe, expect, it } from 'vitest';

import {
  ApiErrorBodySchema,
  DecisionSchema,
  GameIdSchema,
  SHOP_ITEM_PRIOR,
  TurnViewSchema,
} from '../src/index.ts';
import type { TurnView } from '../src/index.ts';

const SAMPLE_TURN_VIEW: TurnView = {
  game: {
    state: { gameId: 'xuRILCk8', lives: 3, gold: 0, dragonLevel: 0, turn: 0, score: 0 },
    status: 'active',
  },
  board: [
    {
      adId: 'qYfhYgFt',
      message: 'Help a farmer',
      reward: 30,
      expiresIn: 5,
      probability: 'Sure thing',
      wasEncrypted: false,
      advice: { verdict: 'recommended', estimatedProbability: 0.95, expectedValue: 25 },
    },
  ],
  shop: [...SHOP_ITEM_PRIOR],
  recommendation: {
    kind: 'solve',
    adId: 'qYfhYgFt',
    reasoning: {
      rule: 'best_expected_value',
      estimatedProbability: 0.95,
      expectedValue: 25,
      consideredCount: 1,
    },
  },
};

describe('identifiers', () => {
  it.each(['xuRILCk8', 'qYfhYgFt', 'wingpotmax', 'a'.repeat(64)])('accepts %s', (id) => {
    expect(GameIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(['', 'a/b', '../x', 'cVlmaFlnRnQ=', ' xuRILCk8', 'a'.repeat(65)])('rejects %j', (id) => {
    expect(GameIdSchema.safeParse(id).success).toBe(false);
  });
});

describe('DecisionSchema', () => {
  it('parses a solve with a scored reasoning', () => {
    const solve = {
      kind: 'solve',
      adId: 'a1',
      reasoning: {
        rule: 'best_expected_value',
        estimatedProbability: 0.9,
        expectedValue: 20,
        consideredCount: 3,
      },
    };

    expect(DecisionSchema.parse(solve)).toEqual(solve);
  });

  it('rejects a solve without an estimate', () => {
    const solve = {
      kind: 'solve',
      adId: 'a1',
      reasoning: {
        rule: 'best_expected_value',
        estimatedProbability: null,
        expectedValue: null,
        consideredCount: 3,
      },
    };

    expect(DecisionSchema.safeParse(solve).success).toBe(false);
  });

  it('parses a stop with no estimate', () => {
    const stop = {
      kind: 'stop',
      reasoning: {
        rule: 'no_viable_option',
        estimatedProbability: null,
        expectedValue: null,
        consideredCount: 0,
      },
    };

    expect(DecisionSchema.parse(stop).kind).toBe('stop');
  });
});

describe('TurnViewSchema', () => {
  it('round-trips a turn view', () => {
    expect(TurnViewSchema.parse(SAMPLE_TURN_VIEW)).toEqual(SAMPLE_TURN_VIEW);
  });
});

describe('ApiErrorBodySchema', () => {
  it('accepts game_over as an error code', () => {
    const body = { error: { code: 'game_over', message: 'Game over' } };

    expect(ApiErrorBodySchema.parse(body).error.code).toBe('game_over');
  });
});
