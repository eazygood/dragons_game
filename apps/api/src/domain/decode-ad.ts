import { AdSchema } from '@bigbank-dragon/contracts';
import type { Ad } from '@bigbank-dragon/contracts';

// The ad as the upstream sends it. Declared here because the domain may not import the
// adapter; the adapter's RawAdSchema produces this shape.
export type RawAd = {
  adId: string;
  message: string;
  reward: number;
  expiresIn: number;
  encrypted: 1 | 2 | null;
  probability: string;
};

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

const decodedFields = ({ raw }: { raw: RawAd }) => {
  const decode = decoderFor(raw.encrypted);

  return {
    adId: decode(raw.adId),
    message: decode(raw.message),
    probability: decode(raw.probability),
    reward: raw.reward,
    expiresIn: raw.expiresIn,
    wasEncrypted: raw.encrypted !== null,
  };
};

export const decodeAd = ({ raw }: { raw: RawAd }): Ad => AdSchema.parse(decodedFields({ raw }));

// An ad whose decoded label is unknown is dropped: the engine cannot price it, and the
// rest of the board is still playable.
export const decodeAds = ({ raws }: { raws: RawAd[] }): Ad[] =>
  raws.flatMap((raw) => {
    const parsedAd = AdSchema.safeParse(decodedFields({ raw }));

    return parsedAd.success ? [parsedAd.data] : [];
  });
