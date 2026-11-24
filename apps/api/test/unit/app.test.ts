import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GameParamsSchema } from '@bigbank-dragon/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import { AdExpiredError } from '../../src/errors/errors.ts';

// Knex pools lazily, so building the app needs no MySQL.
const buildTestApp = async () => {
  const app = await buildApp({ config: loadConfig({ env: {} }), logger: false });

  app.get('/api/test/expired', () => {
    throw new AdExpiredError({ message: 'Ad a1 has expired' });
  });
  app.get('/api/test/crash', () => {
    throw new Error('secret connection string');
  });
  app.post('/api/test/echo', () => ({ ok: true }));
  app.get('/api/test/:gameId', { schema: { params: GameParamsSchema } }, () => ({ ok: true }));

  return app;
};

describe('app', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(() => app.close());

  it('reports liveness', async () => {
    expect((await app.inject({ url: '/api/health' })).json()).toEqual({ status: 'ok' });
  });

  it('maps a domain error to its status and envelope', async () => {
    const response = await app.inject({ url: '/api/test/expired' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'conflict', message: 'Ad a1 has expired' } });
  });

  it('hides unexpected errors behind a 500', async () => {
    const response = await app.inject({ url: '/api/test/crash' });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret');
    expect(response.json()).toEqual({
      error: { code: 'internal', message: 'Internal server error' },
    });
  });

  it('rejects an invalid path param at the boundary', async () => {
    const response = await app.inject({ url: '/api/test/..%2Fx' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('answers a malformed body as a bad request, not a crash', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('accepts a valid path param', async () => {
    expect((await app.inject({ url: '/api/test/g-1' })).json()).toEqual({ ok: true });
  });

  it('answers unknown routes with the envelope', async () => {
    const response = await app.inject({ url: '/api/nope/a/b' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'not_found', message: 'Route not found' } });
  });
});

const NOT_FOUND_ENVELOPE = { error: { code: 'not_found', message: 'Route not found' } };

describe('app serving the web app', () => {
  let app: FastifyInstance;
  let webDistDir: string;

  beforeAll(async () => {
    webDistDir = await mkdtemp(join(tmpdir(), 'web-dist-'));
    await mkdir(join(webDistDir, 'assets'));
    await writeFile(join(webDistDir, 'index.html'), '<div id="root"></div>');
    await writeFile(join(webDistDir, 'assets', 'app.js'), 'console.log("app");');

    app = await buildApp({
      config: loadConfig({ env: { WEB_DIST_DIR: webDistDir } }),
      logger: false,
    });
  });

  afterAll(async () => {
    await app.close();
    await rm(webDistDir, { recursive: true });
  });

  it('serves the web app at the root and its assets', async () => {
    const page = await app.inject({ url: '/' });
    const asset = await app.inject({ url: '/assets/app.js' });

    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('<div id="root">');
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toContain('console.log');
  });

  it('answers client-side routes with the web app', async () => {
    const response = await app.inject({ url: '/watch/abc' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<div id="root">');
  });

  it('keeps unknown API routes as JSON 404s', async () => {
    const response = await app.inject({ url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND_ENVELOPE);
  });

  it('keeps the API health route ahead of the web app', async () => {
    expect((await app.inject({ url: '/api/health' })).json()).toEqual({ status: 'ok' });
  });

  it('does not answer unknown non-GET routes with HTML', async () => {
    const response = await app.inject({ method: 'POST', url: '/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND_ENVELOPE);
  });
});

describe('app without a web app', () => {
  it('serves no web app when none is configured', async () => {
    const app = await buildApp({ config: loadConfig({ env: {} }), logger: false });
    const response = await app.inject({ url: '/' });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND_ENVELOPE);
  });
});

describe('app lifecycle', () => {
  it('exposes the pool as app.db and closes it with the app', async () => {
    const app = await buildTestApp();
    const destroy = vi.spyOn(app.db, 'destroy');

    await app.close();

    expect(destroy).toHaveBeenCalledOnce();
  });
});
