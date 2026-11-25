export type BotGameSlot = {
  signal: AbortSignal;
  /** Keeps the slot taken until the game settles, however it ends. */
  hold(input: { game: Promise<unknown> }): void;
  /** Frees a slot whose game never started. Safe to call after `hold`. */
  release(): void;
};

export type BotGameRegistry = {
  /** Null when the limit is reached or the registry is shutting down. */
  reserve(): BotGameSlot | null;
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

  return { reserve, shutdown };
};
