// Pino's argument order, so the Fastify logger can be passed straight in.
export type Logger = {
  info(details: object, message: string): void;
  warn(details: object, message: string): void;
};
