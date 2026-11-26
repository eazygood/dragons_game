import { Writable } from 'node:stream';

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AdExpiredError,
  GameNotFoundError,
  UpstreamUnavailableError,
} from '../../src/errors/errors.ts';
import { ServiceUnavailableError } from '../../src/errors/service-unavailable-error.ts';
import { TooManyRequestsError } from '../../src/errors/too-many-requests-error.ts';
import { errorHandler } from '../../src/routes/error-handlers/error-handler.ts';

const PINO_WARN_LEVEL = 40;
const RETRY_AFTER_SECONDS = 30;
const UPSTREAM_DETAIL = 'list_ads (GET /secret-game/messages) → 503: <html>busy</html>';

describe('errorHandler', () => {
  let app: FastifyInstance;
  let logLines: string[] = [];

  beforeAll(async () => {
    const logStream = new Writable({
      write: (chunk: Buffer, _encoding, done) => {
        logLines.push(chunk.toString());
        done();
      },
    });

    app = Fastify({ logger: { level: 'warn', stream: logStream } });
    app.setErrorHandler(errorHandler);
    app.get('/upstream-down', () => {
      throw new UpstreamUnavailableError({
        message: 'The Mugloar server is unavailable',
        cause: new Error(UPSTREAM_DETAIL),
      });
    });
    app.get('/shutting-down', () => {
      throw new ServiceUnavailableError({ message: 'Registry closing, 2 games in flight' });
    });
    app.get('/unknown-game', () => {
      throw new GameNotFoundError({ message: 'Game g1 not found' });
    });
    app.get('/expired-ad', () => {
      throw new AdExpiredError({ message: 'Ad a1 has expired' });
    });
    app.get('/busy', () => {
      throw new TooManyRequestsError({
        message: 'Too many bot games',
        retryAfterSeconds: RETRY_AFTER_SECONDS,
      });
    });
    app.get('/busy-no-hint', () => {
      throw new TooManyRequestsError({ message: 'Too many bot games' });
    });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    logLines = [];
  });

  it('answers a 5xx app error with fixed text, never the upstream detail', async () => {
    const response = await app.inject({ url: '/upstream-down' });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: { code: 'upstream_unavailable', message: 'The Mugloar server is unavailable' },
    });
    expect(response.body).not.toMatch(/secret-game|html|503/);
  });

  it('answers a 503 with its own fixed text, not the generic one', async () => {
    const response = await app.inject({ url: '/shutting-down' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: { code: 'service_unavailable', message: 'The server is shutting down' },
    });
  });

  it('logs a 5xx app error at warn, with its cause', async () => {
    await app.inject({ url: '/upstream-down' });

    const entries = logLines.map((line) => JSON.parse(line) as { level: number; err?: object });
    const logged = entries.find((entry) => entry.err !== undefined);

    expect(logged?.level).toBe(PINO_WARN_LEVEL);
    expect(JSON.stringify(logged?.err)).toContain('secret-game/messages');
  });

  it.each([
    { url: '/unknown-game', statusCode: 404, code: 'not_found', message: 'Game g1 not found' },
    { url: '/expired-ad', statusCode: 409, code: 'conflict', message: 'Ad a1 has expired' },
  ])(
    'passes a 4xx app error through with its status, code and message, unlogged: $url',
    async ({ url, statusCode, code, message }) => {
      const response = await app.inject({ url });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toEqual({ error: { code, message } });
      expect(logLines.filter((line) => line.includes('"err"'))).toEqual([]);
    },
  );

  it('tells a client when to retry a 429 our own code raised', async () => {
    const response = await app.inject({ url: '/busy' });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe(String(RETRY_AFTER_SECONDS));
  });

  it('sends no Retry-After when the 429 carries no hint', async () => {
    const response = await app.inject({ url: '/busy-no-hint' });

    expect(response.headers['retry-after']).toBeUndefined();
  });
});
