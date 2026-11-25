import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.ts';
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

  it('refuses a text/plain body, which a cross-site form sends with no preflight', async () => {
    const response = await app.inject({
      method: 'POST',
      url: ECHO_URL,
      headers: { 'content-type': 'text/plain' },
      payload: 'hello',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('refuses a text/plain POST even when the body is empty', async () => {
    const response = await app.inject({
      method: 'POST',
      url: ECHO_URL,
      headers: { 'content-type': 'text/plain' },
    });

    expect(response.statusCode).toBe(415);
  });

  it('still accepts a POST without a body, as the web client sends it', async () => {
    const response = await app.inject({ method: 'POST', url: ECHO_URL });

    expect(response.statusCode).toBe(200);
  });

  it('still accepts a JSON body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: ECHO_URL,
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });

    expect(response.statusCode).toBe(200);
  });
});
