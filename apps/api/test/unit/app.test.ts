import { GameParamsSchema } from '@bigbank-dragon/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';

// Knex pools lazily, so building the app needs no MySQL.
const buildTestApp = async () => {
  const app = await buildApp({ config: loadConfig({ env: {} }), logger: false });

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

  it('answers a malformed URL with the error envelope, not a framework body', async () => {
    const response = await app.inject({ url: '/api/games/%' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
    expect(response.body).not.toContain('FST_ERR');
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
});

describe('app lifecycle', () => {
  it('closes the database pool with the app, so a later query is refused', async () => {
    const app = await buildTestApp();

    await app.close();

    await expect(app.db.raw('select 1')).rejects.toThrow();
  });
});
