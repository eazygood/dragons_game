import type { Logger } from '../../config/logger.ts';
import type { TurnResult } from '../../entities/turn-result.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { PersistenceFailedError } from '../../errors/errors.ts';

// The one error a game outlives (spec §6): the upstream turn already happened,
// so losing its local record must not end the real game.
export const keepPlayingOnPersistenceFailure = async ({
  action,
  logger,
}: {
  action: Promise<UpstreamResult<TurnResult>>;
  logger: Logger;
}): Promise<UpstreamResult<TurnResult>> => {
  try {
    return await action;
  } catch (error) {
    if (!(error instanceof PersistenceFailedError)) {
      throw error;
    }

    logger.warn({ err: error, turn: error.result.state.turn }, 'turn not persisted; playing on');
    return { status: 'ok', value: error.result };
  }
};
