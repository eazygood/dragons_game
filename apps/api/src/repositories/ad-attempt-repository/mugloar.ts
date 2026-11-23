import type { z } from 'zod';

import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import type { UpstreamResult } from '../../adapters/mugloar-api-adapter/index.ts';
import { SolveWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';

export type SolveOutcome = z.infer<typeof SolveWireSchema>;

// adId must already be decoded; the encoded one is a 400.
const createOne = ({
  gameId,
  adId,
}: {
  gameId: string;
  adId: string;
}): Promise<UpstreamResult<SolveOutcome>> =>
  mugloarApiAdapter.request({
    operation: 'solve_ad',
    method: 'POST',
    path: `/${encodeURIComponent(gameId)}/solve/${encodeURIComponent(adId)}`,
    schema: SolveWireSchema,
  });

export const mugloarRepository = { createOne };
