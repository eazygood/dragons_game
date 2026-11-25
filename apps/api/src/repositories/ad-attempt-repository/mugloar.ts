import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import { SolveWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';
import type { SolveOutcome } from '../../entities/ad-attempt.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import { AdExpiredError } from '../../errors/errors.ts';

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

const AD_EXPIRED_MESSAGE = 'The ad has expired or is no longer on the board';

// On solve, and only on solve, a 400 means the ad id is stale or unknown.
const adExpired = ({ cause }: { cause: Error }) =>
  new AdExpiredError({ message: AD_EXPIRED_MESSAGE, cause });

// adId must already be decoded; the encoded one is a 400.
const createOne = ({
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

export const mugloarRepository = { createOne };
