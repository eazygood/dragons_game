import { describe, expect, it } from 'vitest';

import {
  AdSchema,
  DecisionSchema,
  GameIdSchema,
  GameStateSchema,
  IDENTIFIER_MAX_LENGTH,
  RawAdSchema,
  ShopItemSchema,
} from '../src/index.ts';

const RAW_AD = {
  adId: 'cVlmaFlnRnQ=',
  message: 'SGVscCBhIGZhcm1lcg==',
  reward: 30,
  expiresIn: 5,
  encrypted: 1,
  probability: 'R2FtYmxl',
};

const ID_BEARERS = [
  {
    schema: AdSchema,
    field: 'adId',
    valid: {
      adId: 'qYfhYgFt',
      message: 'Help a farmer',
      reward: 30,
      expiresIn: 5,
      probability: 'Gamble',
      wasEncrypted: true,
    },
  },
  {
    schema: ShopItemSchema,
    field: 'id',
    valid: { id: 'hpot', name: 'Healing potion', cost: 50 },
  },
  {
    schema: GameStateSchema,
    field: 'gameId',
    valid: { gameId: 'xuRILCk8', lives: 3, gold: 0, dragonLevel: 0, turn: 0, score: 0 },
  },
];

// These ids end up in upstream URL paths, so none may carry a separator or leftover base64.
const UNSAFE_IDS = ['../shop/buy/hpot', 'a/b', 'cVlmaFlnRnQ=', ''];

describe('identifiers', () => {
  it.each(['xuRILCk8', 'qYfhYgFt', 'wingpotmax', 'a'.repeat(IDENTIFIER_MAX_LENGTH)])(
    'accepts %s',
    (id) => {
      expect(GameIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each(['', 'a/b', '../x', 'cVlmaFlnRnQ=', ' xuRILCk8', 'a'.repeat(IDENTIFIER_MAX_LENGTH + 1)])(
    'rejects %j',
    (id) => {
      expect(GameIdSchema.safeParse(id).success).toBe(false);
    },
  );
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

describe.each(ID_BEARERS)('the $field of a decoded schema', ({ schema, field, valid }) => {
  it('accepts a recorded id', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(UNSAFE_IDS)('refuses %j', (unsafeId) => {
    expect(schema.safeParse({ ...valid, [field]: unsafeId }).success).toBe(false);
  });
});

describe('RawAdSchema', () => {
  it('keeps an encoded adId, which only becomes an identifier once decoded', () => {
    expect(RawAdSchema.safeParse(RAW_AD).success).toBe(true);
  });

  it('refuses an empty adId', () => {
    expect(RawAdSchema.safeParse({ ...RAW_AD, adId: '' }).success).toBe(false);
  });
});
