import type { Ad } from '@bigbank-dragon/contracts';

import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import type { UpstreamResult } from '../../adapters/mugloar-api-adapter/index.ts';
import { AdListWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';
import { decodeAds } from '../../domain/decode-ad.ts';

const DecodedAdListSchema = AdListWireSchema.transform((raws) => decodeAds({ raws }));

const findMany = ({ gameId }: { gameId: string }): Promise<UpstreamResult<Ad[]>> =>
  mugloarApiAdapter.request({
    operation: 'list_ads',
    method: 'GET',
    path: `/${encodeURIComponent(gameId)}/messages`,
    schema: DecodedAdListSchema,
  });

export const mugloarRepository = { findMany };
