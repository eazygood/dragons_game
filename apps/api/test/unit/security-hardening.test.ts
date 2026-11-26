import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { DEFAULT_APP_LIMITS } from '../../src/app-limits.ts';
import { loadConfig } from '../../src/config/index.ts';

const ECHO_URL = '/api/test/echo';

describe('security hardening', () => {
  let app: FastifyInstance;
  let webDistDir: string;

  beforeAll(async () => {
    webDistDir = await mkdtemp(join(tmpdir(), 'web-dist-'));
    await writeFile(join(webDistDir, 'index.html'), '<div id="root"></div>');

    app = await buildApp({
      config: loadConfig({ env: { WEB_DIST_DIR: webDistDir } }),
      logger: false,
    });
    app.post(ECHO_URL, () => ({ ok: true }));
  });

  afterAll(async () => {
    await app.close();
    await rm(webDistDir, { recursive: true });
  });

  it('sends a strict content security policy with the web app', async () => {
    const { headers } = await app.inject({ url: '/' });
    const policy = String(headers['content-security-policy']);

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('upgrade-insecure-requests');
  });

  it.each(['/', '/api/nope', '/watch/abc'])('sets security headers on %s', async (url) => {
    const { headers } = await app.inject({ url });

    expect(headers['content-security-policy']).toBeDefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toBeUndefined();
  });

  it.each([
    { description: 'with a body', payload: 'hello' },
    { description: 'with no body', payload: undefined },
  ])(
    'refuses a text/plain POST $description, which a cross-site form sends with no preflight',
    async ({ payload }) => {
      const response = await app.inject({
        method: 'POST',
        url: ECHO_URL,
        headers: { 'content-type': 'text/plain' },
        payload,
      });

      expect(response.statusCode).toBe(415);
      expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
    },
  );

  it('still accepts a POST without a body, as the web client sends it', async () => {
    const response = await app.inject({ method: 'POST', url: ECHO_URL });

    expect(response.statusCode).toBe(200);
  });

  it('refuses a body over the limit with the error envelope, before parsing it', async () => {
    const response = await app.inject({
      method: 'POST',
      url: ECHO_URL,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ padding: 'x'.repeat(DEFAULT_APP_LIMITS.bodyLimitBytes) }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('accepts a body just inside the limit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: ECHO_URL,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ padding: 'x'.repeat(DEFAULT_APP_LIMITS.bodyLimitBytes / 2) }),
    });

    expect(response.statusCode).toBe(200);
  });
});
