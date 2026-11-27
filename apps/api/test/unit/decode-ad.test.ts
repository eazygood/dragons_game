import { describe, expect, it } from 'vitest';

import type { RawAd } from '../../src/adapters/mugloar-api-adapter/wire-schemas.ts';
import { decodeAds } from '../../src/repositories/game-repository/mugloar.ts';

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
  adId: toBase64(BASE.adId),
  message: toBase64(BASE.message),
  probability: toBase64(BASE.probability),
  encrypted: 1,
};

const decodeOne = ({ raw }: { raw: RawAd }) => decodeAds({ raws: [raw] })[0];

describe('decodeAds', () => {
  it('decodes a base64 adId exactly as the live API requires', () => {
    // Verified 2026-11-23: POST /solve/cVlmaFlnRnQ= is a 400; the decoded id works.
    expect(decodeOne({ raw: { ...BASE64_AD, adId: 'cVlmaFlnRnQ=' } })).toMatchObject({
      adId: 'qYfhYgFt',
      wasEncrypted: true,
    });
  });

  it('decodes encrypted: 2 as rot13', () => {
    const raw: RawAd = { ...BASE, probability: 'Cvrpr bs pnxr', encrypted: 2 };

    expect(decodeOne({ raw })).toMatchObject({ probability: 'Piece of cake', wasEncrypted: true });
  });

  it('decodes the message alongside the id and the label, leaving reward and expiresIn alone', () => {
    expect(decodeOne({ raw: { ...BASE64_AD, reward: 193, expiresIn: 3 } })).toMatchObject({
      message: BASE.message,
      reward: 193,
      expiresIn: 3,
    });
  });

  it('passes a plaintext ad through and marks it unencrypted', () => {
    expect(decodeOne({ raw: BASE })).toMatchObject({ adId: BASE.adId, wasEncrypted: false });
  });

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

  // An id that decodes to a path separator could redirect the solve call to another route.
  it('drops an ad whose decoded id is not a safe identifier', () => {
    const decoded = decodeAds({
      raws: [{ ...BASE64_AD, adId: toBase64('../shop/buy/hpot') }, BASE],
    });

    expect(decoded.map((ad) => ad.adId)).toEqual(['BR0b2WyN']);
  });
});
