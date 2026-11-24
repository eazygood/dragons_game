import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/index.ts';

describe('loadConfig', () => {
  it('defaults to the live upstream with conservative timeouts and retries', () => {
    expect(loadConfig({ env: {} })).toMatchObject({
      mugloarBaseUrl: 'https://dragonsofmugloar.com/api/v2',
      mugloarTimeoutMs: 5000,
      mugloarReadRetries: 2,
      mugloarRatePerSecond: 8,
      mugloarBurst: 8,
      logLevel: 'info',
    });
  });

  it('defaults the API to 127.0.0.1:3000', () => {
    expect(loadConfig({ env: {} })).toMatchObject({ apiHost: '127.0.0.1', apiPort: 3000 });
  });

  it('serves no web app unless WEB_DIST_DIR is set', () => {
    expect(loadConfig({ env: {} }).webDistDir).toBeNull();
    expect(loadConfig({ env: { WEB_DIST_DIR: '/app/apps/web/dist' } }).webDistDir).toBe(
      '/app/apps/web/dist',
    );
  });

  it('rejects a non-numeric port', () => {
    expect(() => loadConfig({ env: { API_PORT: 'abc' } })).toThrow();
  });

  it('reads overrides from the environment', () => {
    const config = loadConfig({ env: { MUGLOAR_TIMEOUT_MS: '750', LOG_LEVEL: 'debug' } });

    expect(config).toMatchObject({ mugloarTimeoutMs: 750, logLevel: 'debug' });
  });

  it('refuses a DATABASE_URL that is not MySQL', () => {
    expect(() => loadConfig({ env: { DATABASE_URL: 'postgres://u:p@host/db' } })).toThrow();
  });

  it('refuses a malformed value rather than running with it', () => {
    expect(() => loadConfig({ env: { MUGLOAR_READ_RETRIES: 'many' } })).toThrow();
  });
});
