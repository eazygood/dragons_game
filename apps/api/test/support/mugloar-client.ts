import type { MugloarClient } from '../../src/adapters/mugloar-api-adapter/index.ts';
import { createMugloarClient } from '../../src/adapters/mugloar-api-adapter/index.ts';
import type { Throttle } from '../../src/adapters/mugloar-api-adapter/index.ts';
import type { AppConfig } from '../../src/config/index.ts';

export const LIVE_AD = {
  adId: 'BR0b2WyN',
  message: 'Help Gisilfrid Jephson to transport a magic wagon to village in Blackcawl',
  reward: 17,
  expiresIn: 7,
  encrypted: null,
  probability: 'Piece of cake',
};

export const NO_THROTTLE: Throttle = { acquire: () => Promise.resolve() };

export const testConfig = ({ baseUrl }: { baseUrl: string }): AppConfig => ({
  mugloarBaseUrl: baseUrl,
  mugloarTimeoutMs: 200,
  mugloarReadRetries: 2,
  mugloarRetryBaseDelayMs: 1,
  databaseUrl: 'mysql://unused:unused@127.0.0.1:3306/unused',
  logLevel: 'silent',
});

export const testClient = ({
  baseUrl,
  throttle = NO_THROTTLE,
}: {
  baseUrl: string;
  throttle?: Throttle;
}): MugloarClient =>
  createMugloarClient({ config: testConfig({ baseUrl }), fetchImpl: fetch, throttle });
