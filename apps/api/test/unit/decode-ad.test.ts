import { describe, expect, it } from 'vitest';

import { decodeAd, decodeAds } from '../../src/domain/decode-ad.ts';
import type { RawAd } from '../../src/domain/decode-ad.ts';

const toBase64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');

const BASE: RawAd = {
  adId: 'BR0b2WyN',
  message: 'Help Gisilfrid Jephson to transport a magic wagon to village in Blackcawl',
  reward: 17,
  expiresIn: 7,
  encrypted: null,
  probability: 'Piece of cake',
};

const BASE64_AD: RawAd = {
  ...BASE,
  message: toBase64(BASE.message),
  probability: toBase64(BASE.probability),
  encrypted: 1,
};

describe('decodeAd', () => {
  it('decodes a base64 adId exactly as the live API requires', () => {
    // Verified 2026-11-23: POST /solve/cVlmaFlnRnQ= is a 400; the decoded id works.
    const decoded = decodeAd({ raw: { ...BASE64_AD, adId: 'cVlmaFlnRnQ=' } });

    expect(decoded.adId).toBe('qYfhYgFt');
    expect(decoded.wasEncrypted).toBe(true);
  });

  it('decodes encrypted: 2 as rot13', () => {
    const raw: RawAd = { ...BASE, probability: 'Cvrpr bs pnxr', encrypted: 2 };

    expect(decodeAd({ raw }).probability).toBe('Piece of cake');
  });

  it('leaves reward and expiresIn untouched when decoding', () => {
    const decoded = decodeAd({ raw: { ...BASE64_AD, reward: 193, expiresIn: 3 } });

    expect(decoded.reward).toBe(193);
    expect(decoded.expiresIn).toBe(3);
  });

  it('decodes the message alongside the id and the label', () => {
    expect(decodeAd({ raw: BASE64_AD }).message).toBe(BASE.message);
  });

  it('passes a plaintext ad through and marks it unencrypted', () => {
    expect(decodeAd({ raw: { ...BASE, encrypted: null } }).wasEncrypted).toBe(false);
  });

  it('rejects a decoded probability that is not a known label', () => {
    expect(() => decodeAd({ raw: { ...BASE, probability: 'Absolutely fine' } })).toThrow();
  });
});

describe('decodeAds', () => {
  it('decodes a mixed board, preserving order', () => {
    const decoded = decodeAds({ raws: [BASE, { ...BASE64_AD, adId: 'cVlmaFlnRnQ=' }] });

    expect(decoded.map((ad) => ad.adId)).toEqual(['BR0b2WyN', 'qYfhYgFt']);
  });

  it('drops an ad whose decoded label is unknown instead of failing the board', () => {
    const decoded = decodeAds({
      raws: [{ ...BASE, adId: 'odd', probability: 'Absolutely fine' }, BASE],
    });

    expect(decoded.map((ad) => ad.adId)).toEqual(['BR0b2WyN']);
  });
});
