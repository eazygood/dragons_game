export type RateLimit = { max: number; timeWindowMs: number };

export type AppLimits = {
  maxBotGames: number;
  requestTimeoutMs: number;
  bodyLimitBytes: number;
  startGameRate: RateLimit;
  playMoveRate: RateLimit;
  readTurnRate: RateLimit;
  pollRate: RateLimit;
};

const ONE_MINUTE_MS = 60_000;

export const DEFAULT_APP_LIMITS: AppLimits = {
  // A bot game is a background loop on the one outbound throttle; more games slow each other.
  maxBotGames: 3,
  // No route reads a request body, so this only bounds a client that trickles its headers.
  requestTimeoutMs: 15_000,
  // No route needs a body; a small cap rejects a flood before it is buffered or parsed.
  bodyLimitBytes: 1024,
  // Opening a game costs an upstream call, and a bot game starts a loop.
  startGameRate: { max: 10, timeWindowMs: ONE_MINUTE_MS },
  // A human clicking as fast as the board refreshes stays well under this.
  playMoveRate: { max: 120, timeWindowMs: ONE_MINUTE_MS },
  // Reading the turn can fetch the board and shop upstream, so it is metered like a move.
  readTurnRate: { max: 60, timeWindowMs: ONE_MINUTE_MS },
  // The web polls these once a second (60 a minute); the limit leaves room for several tabs.
  pollRate: { max: 300, timeWindowMs: ONE_MINUTE_MS },
};
