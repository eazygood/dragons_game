import { describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';

// Nothing listens on port 1, so any query against this database would be refused at once.
const UNREACHABLE_DATABASE_URL = 'mysql://dragon:dragon@127.0.0.1:1/dragon';

describe('health route', () => {
  it('answers 200 without asking the database', async () => {
    const app = await buildApp({
      config: loadConfig({ env: { DATABASE_URL: UNREACHABLE_DATABASE_URL } }),
      logger: false,
    });
    const response = await app.inject({ url: '/api/health' });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
