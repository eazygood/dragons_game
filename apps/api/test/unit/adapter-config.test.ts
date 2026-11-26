import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { loadConfig } from '../../src/config/index.ts';

const importAdapterConfig = () =>
  import('../../src/adapters/mugloar-api-adapter/adapter-config.ts');
const importAdapter = () => import('../../src/adapters/mugloar-api-adapter/index.ts');
const NOT_CONFIGURED_MESSAGE = /not configured.*configureMugloarApi/;

// The adapter keeps its runtime in module state, so each test imports a copy no one has configured.
describe('mugloar api adapter configuration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to hand out a runtime before it is configured', async () => {
    const { mugloarApiRuntime } = await importAdapterConfig();

    expect(() => mugloarApiRuntime()).toThrow(NOT_CONFIGURED_MESSAGE);
  });

  it('does not fall back to MUGLOAR_BASE_URL from the environment', async () => {
    vi.stubEnv('MUGLOAR_BASE_URL', 'https://example.invalid/api/v2');

    const { mugloarApiRuntime } = await importAdapterConfig();

    expect(() => mugloarApiRuntime()).toThrow(NOT_CONFIGURED_MESSAGE);
  });

  it('fails a request made before configuring, without touching the network', async () => {
    const fetchSpy = vi.fn();

    vi.stubGlobal('fetch', fetchSpy);

    const { mugloarApiAdapter } = await importAdapter();

    await expect(
      mugloarApiAdapter.request({
        operation: 'list_ads',
        method: 'GET',
        path: '/g1/messages',
        schema: z.unknown(),
      }),
    ).rejects.toThrow(NOT_CONFIGURED_MESSAGE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('serves the config it was given once configured', async () => {
    const { configureMugloarApi, mugloarApiRuntime } = await importAdapterConfig();
    const config = loadConfig({ env: { MUGLOAR_BASE_URL: 'http://127.0.0.1:1' } });

    configureMugloarApi({ config });

    expect(mugloarApiRuntime().config).toBe(config);
  });
});
