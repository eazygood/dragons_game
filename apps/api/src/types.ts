// Pino's argument order, so the Fastify logger can be passed straight in.
export type Logger = {
  info(details: object, message: string): void;
  warn(details: object, message: string): void;
  error(details: object, message: string): void;
};

// Game Over is a terminal state every game call can reach, upstream or local, so it is a
// result, not an error.
export type OrGameOver<T> = { status: 'ok'; value: T } | { status: 'game_over' };
