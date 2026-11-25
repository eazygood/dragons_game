import { describe, expect, it } from 'vitest';

import { RawAdSchema } from '../../src/adapters/mugloar-api-adapter/wire-schemas.ts';
import { LIVE_AD } from '../support/mugloar-api.ts';

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
