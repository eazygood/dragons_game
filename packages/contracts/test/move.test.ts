import { describe, expect, it } from 'vitest';

import { MoveListSchema, MoveSchema } from '../src/index.ts';

const SOLVE = {
  kind: 'solve',
  turn: 3,
  success: true,
  probability: 'Sure thing',
  reward: 30,
  estimatedProbability: 0.95,
  expectedValue: 25,
  rule: 'best_expected_value',
};

const BUY = {
  kind: 'buy',
  turn: 4,
  success: true,
  itemName: 'Healing potion',
  cost: 50,
  rule: 'survival_floor',
};

describe('MoveSchema', () => {
  it.each([SOLVE, BUY])('round-trips a $kind move', (move) => {
    expect(MoveSchema.parse(move)).toEqual(move);
  });

  it('accepts a solve written before the rule was recorded', () => {
    expect(MoveSchema.parse({ ...SOLVE, rule: null })).toMatchObject({ rule: null });
  });

  it('accepts a buy written before the rule and name were recorded', () => {
    expect(MoveSchema.parse({ ...BUY, rule: null, itemName: null })).toMatchObject({
      rule: null,
      itemName: null,
    });
  });

  it('accepts the player choice as a rule', () => {
    expect(MoveSchema.parse({ ...BUY, rule: 'player_choice' })).toMatchObject({
      rule: 'player_choice',
    });
  });

  it.each([
    ['an unknown rule', { ...SOLVE, rule: 'hunch' }],
    ['an unknown probability label', { ...SOLVE, probability: 'Probably' }],
    ['an unknown kind', { ...SOLVE, kind: 'stop' }],
    ['a solve without an estimate', { ...SOLVE, estimatedProbability: undefined }],
    ['a buy without a cost', { ...BUY, cost: undefined }],
  ])('rejects %s', (_label, move) => {
    expect(MoveSchema.safeParse(move).success).toBe(false);
  });
});

describe('MoveListSchema', () => {
  it('parses solves and buys together', () => {
    expect(MoveListSchema.parse([BUY, SOLVE])).toEqual([BUY, SOLVE]);
  });

  it('parses an empty list', () => {
    expect(MoveListSchema.parse([])).toEqual([]);
  });
});
