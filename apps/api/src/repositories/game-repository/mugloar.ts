import { AdSchema } from '@dragons-game/contracts';
import type { Ad, GameState, ShopItem } from '@dragons-game/contracts';
import { z } from 'zod';

import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import {
  AdListWireSchema,
  BuyWireSchema,
  GameStartWireSchema,
  ShopWireSchema,
  SolveWireSchema,
} from '../../adapters/mugloar-api-adapter/wire-schemas.ts';
import type { RawAd } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';
import { AdExpiredError, UpstreamUnavailableError } from '../../errors/errors.ts';
import type { OrGameOver } from '../../types.ts';

// What a solve reports back; the turn's attempt row is built from it.
export type SolveOutcome = {
  success: boolean;
  lives: number;
  gold: number;
  score: number;
  turn: number;
  message: string;
};

// A board read: the ads that can be played, and how many the upstream sent that could not.
export type DecodedBoard = { ads: Ad[]; droppedCount: number };

// What a buy reports back; level only counts when the purchase succeeded.
export type BuyOutcome = {
  success: boolean;
  lives: number;
  gold: number;
  level: number;
  turn: number;
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

// An ad is dropped when its decoded label is unknown (the engine cannot price it) or its
// decoded id is unsafe in the solve URL; the rest of the board is still playable.
export const decodeAds = ({ raws }: { raws: RawAd[] }): Ad[] =>
  raws.flatMap((raw) => {
    const parsedAd = AdSchema.safeParse(decodedFields({ raw }));

    return parsedAd.success ? [parsedAd.data] : [];
  });

// Counted against the raw entries, so an ad dropped for its shape and one dropped for its
// decoded content both show.
const DecodedBoardSchema = z.array(z.unknown()).transform((entries): DecodedBoard => {
  const ads = decodeAds({ raws: AdListWireSchema.parse(entries) });

  return { ads, droppedCount: entries.length - ads.length };
});

// Neither a start nor a solve passes on highScore: it is the server's global record, not this
// game's, and nothing downstream reads it.
const StartedGameStateSchema = GameStartWireSchema.transform(
  ({ gameId, lives, gold, level, score, turn }): GameState => ({
    gameId,
    lives,
    gold,
    dragonLevel: level,
    turn,
    score,
  }),
);

const SolveOutcomeSchema = SolveWireSchema.transform(
  ({ success, lives, gold, score, turn, message }): SolveOutcome => ({
    success,
    lives,
    gold,
    score,
    turn,
    message,
  }),
);

const BuyOutcomeSchema = BuyWireSchema.transform(
  ({ shoppingSuccess, lives, gold, level, turn }): BuyOutcome => ({
    success: shoppingSuccess,
    lives,
    gold,
    level,
    turn,
  }),
);

const AD_EXPIRED_MESSAGE = 'The ad has expired or is no longer on the board';

// On solve, and only on solve, a 400 means the ad id is stale or unknown.
const adExpired = ({ cause }: { cause: Error }) =>
  new AdExpiredError({ message: AD_EXPIRED_MESSAGE, cause });

// No game exists yet, so Game Over on a start is an upstream fault, not an ending.
export const startGame = async (): Promise<GameState> => {
  const result = await mugloarApiAdapter.request({
    operation: 'start_game',
    method: 'POST',
    path: '/game/start',
    schema: StartedGameStateSchema,
  });

  if (result.status === 'game_over') {
    throw new UpstreamUnavailableError({ message: 'start_game answered Game Over' });
  }

  return result.value;
};

export const findAds = ({ gameId }: { gameId: string }): Promise<OrGameOver<DecodedBoard>> =>
  mugloarApiAdapter.request({
    operation: 'list_ads',
    method: 'GET',
    path: `/${encodeURIComponent(gameId)}/messages`,
    schema: DecodedBoardSchema,
  });

// adId must already be decoded; the encoded one is a 400.
export const solveAd = ({
  gameId,
  adId,
}: {
  gameId: string;
  adId: string;
}): Promise<OrGameOver<SolveOutcome>> =>
  mugloarApiAdapter.request({
    operation: 'solve_ad',
    method: 'POST',
    path: `/${encodeURIComponent(gameId)}/solve/${encodeURIComponent(adId)}`,
    schema: SolveOutcomeSchema,
    badRequestError: adExpired,
  });

export const findShopItems = ({ gameId }: { gameId: string }): Promise<OrGameOver<ShopItem[]>> =>
  mugloarApiAdapter.request({
    operation: 'list_shop_items',
    method: 'GET',
    path: `/${encodeURIComponent(gameId)}/shop`,
    schema: ShopWireSchema,
  });

export const buyItem = ({
  gameId,
  itemId,
}: {
  gameId: string;
  itemId: string;
}): Promise<OrGameOver<BuyOutcome>> =>
  mugloarApiAdapter.request({
    operation: 'buy_item',
    method: 'POST',
    path: `/${encodeURIComponent(gameId)}/shop/buy/${encodeURIComponent(itemId)}`,
    schema: BuyOutcomeSchema,
  });
