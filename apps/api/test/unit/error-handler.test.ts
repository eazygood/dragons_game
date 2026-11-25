import { Writable } from 'node:stream';

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { GameNotFoundError, UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { errorHandler } from '../../src/routes/error-handlers/error-handler.ts';

const PINO_WARN_LEVEL = 40;
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
    app.get('/unknown-game', () => {
      throw new GameNotFoundError({ message: 'Game g1 not found' });
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

  it('logs a 5xx app error at warn, with its cause', async () => {
    await app.inject({ url: '/upstream-down' });

    const entries = logLines.map((line) => JSON.parse(line) as { level: number; err?: object });
    const logged = entries.find((entry) => entry.err !== undefined);

    expect(logged?.level).toBe(PINO_WARN_LEVEL);
    expect(JSON.stringify(logged?.err)).toContain('secret-game/messages');
  });

  it('passes a 4xx app error through with its own message, unlogged', async () => {
    const response = await app.inject({ url: '/unknown-game' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'not_found', message: 'Game g1 not found' } });
    expect(logLines.filter((line) => line.includes('"err"'))).toEqual([]);
  });
});
