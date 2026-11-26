import { configureMugloarApi } from '../../src/adapters/mugloar-api-adapter/index.ts';
import type { MugloarApiConfig } from '../../src/adapters/mugloar-api-adapter/adapter-config.ts';
import { loadConfig } from '../../src/config/index.ts';

export const LIVE_AD = {
  adId: 'BR0b2WyN',
  message: 'Help Gisilfrid Jephson to transport a magic wagon to village in Blackcawl',
  reward: 17,
  expiresIn: 7,
  encrypted: null,
  probability: 'Piece of cake',
};

// The fast test settings from vitest.config.ts, aimed at a test's own stub. Configuring
// also builds a fresh throttle, so no test inherits another's spent rate limit.
export const pointAdapterAt = ({
  baseUrl,
  overrides = {},
}: {
  baseUrl: string;
  overrides?: Partial<MugloarApiConfig>;
}) => {
  configureMugloarApi({
    config: { ...loadConfig({ env: process.env }), mugloarBaseUrl: baseUrl, ...overrides },
  });
};
