import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';

const WRITE_URL = '/api/test/write';
const READ_URL = '/api/test/read';
const HOST = 'localhost:3000';
const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

describe('cross-site guard', () => {
  let app: FastifyInstance;

  const write = ({
    method = 'POST',
    headers = {},
  }: {
    method?: (typeof UNSAFE_METHODS)[number];
    headers?: Record<string, string>;
  }) => app.inject({ method, url: WRITE_URL, headers: { host: HOST, ...headers } });

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ env: {} }), logger: false });
    app.route({ method: [...UNSAFE_METHODS], url: WRITE_URL, handler: () => ({ ok: true }) });
    app.get(READ_URL, () => ({ ok: true }));
  });

  afterAll(() => app.close());

  it('refuses a write the browser marks cross-site, with the error envelope', async () => {
    const response = await write({ headers: { 'sec-fetch-site': 'cross-site' } });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { code: 'invalid_request', message: 'Cross-site requests are not allowed' },
    });
  });

  it('sends the security headers on the refusal too', async () => {
    const { headers } = await write({ headers: { 'sec-fetch-site': 'cross-site' } });

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toBeDefined();
  });

  it.each(UNSAFE_METHODS)('refuses a cross-site %s', async (method) => {
    const response = await write({ method, headers: { 'sec-fetch-site': 'cross-site' } });

    expect(response.statusCode).toBe(403);
  });

  it.each(['https://evil.example', 'http://localhost:3001', 'http://localhost', 'null'])(
    'refuses a write whose Origin %s is not the host being called',
    async (origin) => {
      const response = await write({ headers: { origin } });

      expect(response.statusCode).toBe(403);
    },
  );

  it('refuses a cross-site Origin even when Sec-Fetch-Site claims same-origin', async () => {
    const response = await write({
      headers: { 'sec-fetch-site': 'same-origin', origin: 'https://evil.example' },
    });

    expect(response.statusCode).toBe(403);
  });

  it.each([`http://${HOST}`, `http://${HOST.toUpperCase()}`])(
    'lets a write through when its Origin %s is the host being called',
    async (origin) => {
      const response = await write({ headers: { origin } });

      expect(response.statusCode).toBe(200);
    },
  );

  it.each(['same-origin', 'same-site', 'none'])(
    'lets a write the browser marks %s through',
    async (fetchSite) => {
      const response = await write({ headers: { 'sec-fetch-site': fetchSite } });

      expect(response.statusCode).toBe(200);
    },
  );

  it('lets a write with neither header through, as curl, the CLI and tests send it', async () => {
    expect((await write({})).statusCode).toBe(200);
  });

  it('never blocks a read, which changes nothing', async () => {
    const response = await app.inject({
      url: READ_URL,
      headers: { host: HOST, 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
    });

    expect(response.statusCode).toBe(200);
  });
});
