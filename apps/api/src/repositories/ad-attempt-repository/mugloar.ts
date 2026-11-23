import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import { SolveWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';
import type { SolveOutcome } from '../../entities/ad-attempt.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';

// highScore is the server's global record, not this game's; nothing downstream reads it.
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
    schema: SolveOutcomeSchema,
  });

export const mugloarRepository = { createOne };
