import type { GameView } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../entities/logger.ts';
import { ServiceUnavailableError } from '../../errors/service-unavailable-error.ts';
import { TooManyRequestsError } from '../../errors/too-many-requests-error.ts';
import { playGame } from '../../managers/bot-manager/index.ts';
import { startGameRun } from '../../managers/game-manager/index.ts';
import { toGameView } from '../shared/game-view.ts';
import type { BotGameRegistry } from './bot-game-registry.ts';

// A bot game takes a minute or two, so half a minute is a fair first wait for a free slot.
export const BOT_SLOT_RETRY_AFTER_SECONDS = 30;

export const startBotGame = async ({
  db,
  logger,
  registry,
}: {
  db: Knex;
  logger: Logger;
  registry: BotGameRegistry;
}): Promise<GameView> => {
  const slot = registry.reserve();

  if (slot === null && registry.isClosing()) {
    throw new ServiceUnavailableError({ message: 'The server is shutting down' });
  }

  if (slot === null) {
    throw new TooManyRequestsError({
      message: 'Too many bot games are running; try again when one has finished',
      retryAfterSeconds: BOT_SLOT_RETRY_AFTER_SECONDS,
    });
  }

  try {
    const strategy = 'calibrated';
    const { run, state } = await startGameRun({ db, strategy });
    const gameView = toGameView({ run });

    // The registry, not the request, awaits the game: it outlives the request. playGame
    // abandons the run before it rejects, so this catch only has to report the failure.
    slot.hold({
      game: playGame({
        db,
        run,
        state,
        strategy,
        calibrationBenchmarkId: null,
        logger,
        signal: slot.signal,
      }).catch((error: unknown) =>
        logger.error({ err: error, gameId: run.gameId }, 'bot game failed'),
      ),
    });

    return gameView;
  } catch (error) {
    slot.release();
    throw error;
  }
};
