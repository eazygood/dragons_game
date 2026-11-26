import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { CrossSiteRequestError } from '../errors/cross-site-request-error.ts';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CROSS_SITE = 'cross-site';
const REFUSAL_MESSAGE = 'Cross-site requests are not allowed';

// An Origin that is not a URL (the literal "null" of a sandboxed frame) has no host to match.
const hostOfOrigin = ({ origin }: { origin: string }) => {
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
};

// Browsers always send Sec-Fetch-Site or Origin on a cross-site write; curl, the CLI and
// tests send neither, so they pass.
const isCrossSite = ({ request }: { request: FastifyRequest }) => {
  const { origin, host, 'sec-fetch-site': fetchSite } = request.headers;

  if (fetchSite === CROSS_SITE) {
    return true;
  }

  return origin !== undefined && hostOfOrigin({ origin }) !== host?.toLowerCase();
};

// Stops a page on another site from driving the game through a visitor's browser: CORS does
// not block such a request, it only hides the response.
export const crossSiteGuardPlugin = fp((app) => {
  app.addHook('onRequest', (request, _reply, done) => {
    const refused = UNSAFE_METHODS.has(request.method) && isCrossSite({ request });

    done(refused ? new CrossSiteRequestError({ message: REFUSAL_MESSAGE }) : undefined);
  });

  return Promise.resolve();
});
