import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import { databaseRepository } from '../../src/repositories/index.ts';

// Nothing listens on port 1, so the pool's first connection is refused at once.
const UNREACHABLE_DATABASE_URL = 'mysql://dragon:dragon@127.0.0.1:1/dragon';

describe('health route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers 200 when the database answers', async () => {
    vi.spyOn(databaseRepository.db, 'ping').mockResolvedValue(undefined);

    const app = await buildApp({ config: loadConfig({ env: {} }), logger: false });
    const response = await app.inject({ url: '/api/health' });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('answers 503 without leaking the cause when the probe fails', async () => {
    vi.spyOn(databaseRepository.db, 'ping').mockRejectedValue(
      new Error('connect ECONNREFUSED mysql://dragon:secret@db'),
    );

    const app = await buildApp({ config: loadConfig({ env: {} }), logger: false });
    const response = await app.inject({ url: '/api/health' });

    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable' });
    expect(response.body).not.toContain('secret');
  });

  it('answers 503 against a database that is really down', async () => {
    const app = await buildApp({
      config: loadConfig({ env: { DATABASE_URL: UNREACHABLE_DATABASE_URL } }),
      logger: false,
    });
    const response = await app.inject({ url: '/api/health' });

    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable' });
  });
});
