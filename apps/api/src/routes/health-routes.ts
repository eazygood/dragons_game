import type { FastifyInstance } from 'fastify';

// Liveness only: it answers while the process does. MySQL has its own healthcheck in compose.
export const registerHealthRoutes = (app: FastifyInstance) => {
  app.get('/health', () => ({ status: 'ok' }));
};
