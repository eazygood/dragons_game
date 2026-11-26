import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';

const NOT_FOUND_ENVELOPE = { error: { code: 'not_found', message: 'Route not found' } };
const SPA_MARKER = '<div id="root">';
const DOTFILE_CONTENT = 'DATABASE_PASSWORD=hunter2';
const HASHED_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';

describe('app serving the web app', () => {
  let app: FastifyInstance;
  let webDistDir: string;

  beforeAll(async () => {
    webDistDir = await mkdtemp(join(tmpdir(), 'web-dist-'));
    await mkdir(join(webDistDir, 'assets'));
    await writeFile(join(webDistDir, 'index.html'), `${SPA_MARKER}</div>`);
    await writeFile(join(webDistDir, 'favicon.svg'), '<svg/>');
    await writeFile(join(webDistDir, '.env'), DOTFILE_CONTENT);
    await writeFile(join(webDistDir, 'assets', 'app-4f2a9c1e.js'), 'console.log("app");');
    await writeFile(join(webDistDir, 'assets', '.hidden'), DOTFILE_CONTENT);

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
    const asset = await app.inject({ url: '/assets/app-4f2a9c1e.js' });

    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain(SPA_MARKER);
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toContain('console.log');
  });

  it('answers client-side routes with the web app', async () => {
    const response = await app.inject({ url: '/watch/abc' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain(SPA_MARKER);
  });

  it('caches a hashed asset for a year and never marks it for revalidation', async () => {
    const { headers } = await app.inject({ url: '/assets/app-4f2a9c1e.js' });

    expect(headers['cache-control']).toBe(HASHED_ASSET_CACHE_CONTROL);
  });

  it.each(['/', '/index.html', '/watch/abc', '/favicon.svg'])(
    'makes the client revalidate %s on every load, because it names the hashed assets',
    async (url) => {
      const { headers } = await app.inject({ url });

      expect(headers['cache-control']).toBe('no-cache');
    },
  );

  it.each(['/.env', '/assets/.hidden'])('refuses the dotfile %s', async (url) => {
    const response = await app.inject({ url });

    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain(DOTFILE_CONTENT);
  });

  it('serves the web app for a path that only starts like the API prefix', async () => {
    const response = await app.inject({ url: '/apifoo' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain(SPA_MARKER);
  });

  it.each(['/api', '/api?x=1', '/api/unknown', '/api/nope/a/b'])(
    'keeps %s a JSON 404 instead of serving the web app',
    async (url) => {
      const response = await app.inject({ url });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND_ENVELOPE);
    },
  );

  it('does not answer unknown non-GET routes with HTML', async () => {
    const response = await app.inject({ method: 'POST', url: '/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND_ENVELOPE);
  });
});

describe('app without a web app', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ env: {} }), logger: false });
  });

  afterAll(() => app.close());

  it.each(['/', '/api/nope'])('answers %s with the JSON 404', async (url) => {
    const response = await app.inject({ url });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND_ENVELOPE);
  });
});
