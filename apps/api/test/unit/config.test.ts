import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/index.ts';

describe('loadConfig', () => {
  // Unconfigured, it must play the real game and stay off the network interfaces.
  it('defaults to the live upstream and a loopback-only API', () => {
    expect(loadConfig({ env: {} })).toMatchObject({
      mugloarBaseUrl: 'https://dragonsofmugloar.com/api/v2',
      apiHost: '127.0.0.1',
    });
  });

  it('serves no web app unless WEB_DIST_DIR is set', () => {
    expect(loadConfig({ env: {} }).webDistDir).toBeNull();
    expect(loadConfig({ env: { WEB_DIST_DIR: '/app/apps/web/dist' } }).webDistDir).toBe(
      '/app/apps/web/dist',
    );
  });

  it('reads overrides from the environment', () => {
    const config = loadConfig({ env: { MUGLOAR_TIMEOUT_MS: '750', LOG_LEVEL: 'debug' } });

    expect(config).toMatchObject({ mugloarTimeoutMs: 750, logLevel: 'debug' });
  });

  it('refuses a DATABASE_URL that is not MySQL', () => {
    expect(() => loadConfig({ env: { DATABASE_URL: 'postgres://u:p@host/db' } })).toThrow();
  });

  it.each([
    ['API_PORT', 'abc'],
    ['MUGLOAR_READ_RETRIES', 'many'],
  ])('refuses a non-numeric %s rather than running with it', (name, value) => {
    expect(() => loadConfig({ env: { [name]: value } })).toThrow();
  });
});
