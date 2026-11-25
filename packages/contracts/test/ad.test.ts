import { describe, expect, it } from 'vitest';

import { RawAdSchema } from '../src/index.ts';

// Captured verbatim from the live API.
const LIVE_AD = {
  adId: 'BR0b2WyN',
  message: 'Help Gisilfrid Jephson to transport a magic wagon to village in Blackcawl',
  reward: 17,
  expiresIn: 7,
  encrypted: null,
  probability: 'Piece of cake',
};

describe('RawAdSchema', () => {
  it('parses a live ad with a numeric reward', () => {
    expect(RawAdSchema.parse(LIVE_AD).reward).toBe(17);
  });

  it('rejects a stringified reward, because the published docs are wrong', () => {
    expect(() => RawAdSchema.parse({ ...LIVE_AD, reward: '17' })).toThrow();
  });

  it('accepts the encrypted markers 1 and 2 and nothing else', () => {
    expect(RawAdSchema.parse({ ...LIVE_AD, encrypted: 2 }).encrypted).toBe(2);
    expect(() => RawAdSchema.parse({ ...LIVE_AD, encrypted: 3 })).toThrow();
  });
});
