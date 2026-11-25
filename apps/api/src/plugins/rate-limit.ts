import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { TooManyRequestsError } from '../errors/too-many-requests-error.ts';

// Routes opt in through config.rateLimit; the polled GETs stay unlimited.
// The builder's return value is thrown, so the error handler maps it like any other AppError.
export const rateLimitPlugin = fp(async (app) => {
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, { after }) =>
      new TooManyRequestsError({ message: `Too many requests; retry in ${after}` }),
  });
});
