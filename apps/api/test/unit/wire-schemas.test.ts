import { describe, expect, it } from 'vitest';

import { RawAdSchema } from '../../src/adapters/mugloar-api-adapter/wire-schemas.ts';

const RAW_AD = {
  adId: 'cVlmaFlnRnQ=',
  message: 'SGVscCBhIGZhcm1lcg==',
  reward: 30,
  expiresIn: 5,
  encrypted: 1,
  probability: 'R2FtYmxl',
};

describe('RawAdSchema', () => {
  it('keeps an encoded adId, which only becomes an identifier once decoded', () => {
    expect(RawAdSchema.safeParse(RAW_AD).success).toBe(true);
  });

  it('refuses an empty adId', () => {
    expect(RawAdSchema.safeParse({ ...RAW_AD, adId: '' }).success).toBe(false);
  });
});
