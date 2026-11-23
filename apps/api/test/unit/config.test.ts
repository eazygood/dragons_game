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

  it('reads overrides from the environment', () => {
    const config = loadConfig({ env: { MUGLOAR_TIMEOUT_MS: '750', LOG_LEVEL: 'debug' } });

    expect(config).toMatchObject({ mugloarTimeoutMs: 750, logLevel: 'debug' });
  });

  it('refuses a malformed value rather than running with it', () => {
    expect(() => loadConfig({ env: { MUGLOAR_READ_RETRIES: 'many' } })).toThrow();
  });
});
