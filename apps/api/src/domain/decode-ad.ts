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

// An ad is dropped when its decoded label is unknown (the engine cannot price it) or its
// decoded id is unsafe in the solve URL; the rest of the board is still playable.
export const decodeAds = ({ raws }: { raws: RawAd[] }): Ad[] =>
  raws.flatMap((raw) => {
    const parsedAd = AdSchema.safeParse(decodedFields({ raw }));

    return parsedAd.success ? [parsedAd.data] : [];
  });
