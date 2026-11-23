import type { Ad, GameSnapshot, ShopItem } from '@bigbank-dragon/contracts';
import type { z } from 'zod';

import type { AppConfig } from '../../config/index.ts';
import { decodeAds } from '../../domain/decode-ad.ts';
import { UpstreamUnavailableError } from '../../errors/errors.ts';
import { createRequest } from './request.ts';
import type { Throttle, UpstreamResult } from './request.ts';
import {
  AdListWireSchema,
  BuyWireSchema,
  GameStartWireSchema,
  ShopWireSchema,
  SolveWireSchema,
} from './wire-schemas.ts';

export type { Throttle, UpstreamResult } from './request.ts';

export type SolveOutcome = z.infer<typeof SolveWireSchema>;
export type BuyOutcome = z.infer<typeof BuyWireSchema>;

export type MugloarClient = {
  startGame(): Promise<GameSnapshot>;
  fetchAds({ gameId }: { gameId: string }): Promise<UpstreamResult<Ad[]>>;
  solveAd({
    gameId,
    adId,
  }: {
    gameId: string;
    adId: string;
  }): Promise<UpstreamResult<SolveOutcome>>;
  fetchShop({ gameId }: { gameId: string }): Promise<UpstreamResult<ShopItem[]>>;
  buyItem({
    gameId,
    itemId,
  }: {
    gameId: string;
    itemId: string;
  }): Promise<UpstreamResult<BuyOutcome>>;
};

// Writes are never retried: solve and buy are not idempotent, and a retried
// start whose first response was lost would silently open a second game.
const NO_RETRIES = 0;

const segment = (value: string) => encodeURIComponent(value);

const DecodedAdListSchema = AdListWireSchema.transform((raws) => decodeAds({ raws }));
const ShopItemsSchema = ShopWireSchema.transform(({ items }) => items);

export const createMugloarClient = ({
  config,
  fetchImpl,
  throttle,
}: {
  config: AppConfig;
  fetchImpl: typeof fetch;
  throttle: Throttle;
}): MugloarClient => {
  const request = createRequest({ config, fetchImpl, throttle });
  const readRetries = config.mugloarReadRetries;

  return {
    startGame: async () => {
      const result = await request({
        method: 'POST',
        path: '/game/start',
        retries: NO_RETRIES,
        schema: GameStartWireSchema,
      });

      if (result.status === 'game_over') {
        throw new UpstreamUnavailableError({ message: 'POST /game/start answered Game Over' });
      }

      return result.value;
    },
    fetchAds: ({ gameId }) =>
      request({
        method: 'GET',
        path: `/${segment(gameId)}/messages`,
        retries: readRetries,
        schema: DecodedAdListSchema,
      }),
    solveAd: ({ gameId, adId }) =>
      request({
        method: 'POST',
        path: `/${segment(gameId)}/solve/${segment(adId)}`,
        retries: NO_RETRIES,
        schema: SolveWireSchema,
      }),
    fetchShop: ({ gameId }) =>
      request({
        method: 'GET',
        path: `/${segment(gameId)}/shop`,
        retries: readRetries,
        schema: ShopItemsSchema,
      }),
    buyItem: ({ gameId, itemId }) =>
      request({
        method: 'POST',
        path: `/${segment(gameId)}/shop/buy/${segment(itemId)}`,
        retries: NO_RETRIES,
        schema: BuyWireSchema,
      }),
  };
};
