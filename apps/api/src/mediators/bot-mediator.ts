import type { GameView } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import { DEFAULT_BOT_STRATEGY } from '../entities/game-run.ts';
import { ServiceUnavailableError } from '../errors/service-unavailable-error.ts';
import { TooManyRequestsError } from '../errors/too-many-requests-error.ts';
import * as botManager from '../managers/bot-manager.ts';
import * as gameManager from '../managers/game-manager/index.ts';
import type { Logger } from '../types.ts';

// A bot game takes a minute or two, so half a minute is a fair first wait for a free slot.
export const BOT_SLOT_RETRY_AFTER_SECONDS = 30;

type BotGameSlot = {
  signal: AbortSignal;
  /** Keeps the slot taken until the game settles, however it ends. */
  hold(input: { game: Promise<unknown> }): void;
  /** Frees a slot whose game never started. Safe to call after `hold`. */
  release(): void;
};

export type BotGameRegistry = {
  /** Null when the limit is reached or the registry is shutting down. */
  reserve(): BotGameSlot | null;
  /** Tells a refused reservation apart: a full registry recovers, a closing one does not. */
  isClosing(): boolean;
  /** Signals every game to stop, then waits until each has finished its run. */
  shutdown(): Promise<void>;
};

type Reservation = { controller: AbortController; settled: Promise<void> };

// A slot is reserved before the upstream game exists, so concurrent requests cannot all pass
// a check made before any of them has registered.
export const createBotGameRegistry = ({ limit }: { limit: number }): BotGameRegistry => {
  const reservations = new Set<Reservation>();
  let isClosing = false;

  const reserve = (): BotGameSlot | null => {
    if (isClosing || reservations.size >= limit) {
      return null;
    }

    const controller = new AbortController();
    const { promise: settled, resolve } = Promise.withResolvers<void>();
    const reservation: Reservation = { controller, settled };
    const release = () => {
      reservations.delete(reservation);
      resolve();
    };

    reservations.add(reservation);

    return {
      signal: controller.signal,
      hold: ({ game }) => {
        void game.then(release, release);
      },
      release,
    };
  };

  const shutdown = async () => {
    isClosing = true;

    const open = [...reservations];

    open.forEach(({ controller }) => controller.abort());
    await Promise.all(open.map(({ settled }) => settled));
  };

  return { reserve, isClosing: () => isClosing, shutdown };
};

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
    const strategy = DEFAULT_BOT_STRATEGY;
    const { run, state } = await gameManager.startGameRun({ db, strategy });
    const gameView = gameManager.toGameView({ run });

    // The registry, not the request, awaits the game: it outlives the request. playGame
    // abandons the run before it rejects, so this catch only has to report the failure.
    slot.hold({
      game: botManager
        .playGame({
          db,
          run,
          state,
          strategy,
          calibrationBenchmarkId: null,
          logger,
          signal: slot.signal,
        })
        .catch((error: unknown) =>
          logger.error({ err: error, gameId: run.gameId }, 'bot game failed'),
        ),
    });

    return gameView;
  } catch (error) {
    slot.release();
    throw error;
  }
};
