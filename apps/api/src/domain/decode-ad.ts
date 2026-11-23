import { AdSchema } from '@bigbank-dragon/contracts';
import type { Ad, RawAd } from '@bigbank-dragon/contracts';

const ALPHABET_LENGTH = 26;
const ROT13_SHIFT = 13;

const rot13 = (value: string): string =>
  value.replace(/[a-z]/gi, (letter) => {
    const base = letter <= 'Z' ? 'A'.charCodeAt(0) : 'a'.charCodeAt(0);
    const shifted = ((letter.charCodeAt(0) - base + ROT13_SHIFT) % ALPHABET_LENGTH) + base;

    return String.fromCharCode(shifted);
  });

const fromBase64 = (value: string): string => Buffer.from(value, 'base64').toString('utf8');

const decoderFor = (encrypted: RawAd['encrypted']): ((value: string) => string) => {
  if (encrypted === 1) {
    return fromBase64;
  }

  if (encrypted === 2) {
    return rot13;
  }

  return (value) => value;
};

export const decodeAd = ({ raw }: { raw: RawAd }): Ad => {
  const decode = decoderFor(raw.encrypted);

  return AdSchema.parse({
    adId: decode(raw.adId),
    message: decode(raw.message),
    probability: decode(raw.probability),
    reward: raw.reward,
    expiresIn: raw.expiresIn,
    wasEncrypted: raw.encrypted !== null,
  });
};

export const decodeAds = ({ raws }: { raws: RawAd[] }): Ad[] =>
  raws.map((raw) => decodeAd({ raw }));
