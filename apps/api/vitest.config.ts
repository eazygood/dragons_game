import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'mysql://dragon:dragon@127.0.0.1:3306/dragon_test';

// Fast, local settings for the upstream adapter; a test points it at its own
// stub with vi.stubEnv, so nothing reaches the live API by accident.
const MUGLOAR_TEST_ENV = {
  MUGLOAR_BASE_URL: 'http://127.0.0.1:1',
  MUGLOAR_TIMEOUT_MS: '200',
  MUGLOAR_READ_RETRIES: '2',
  MUGLOAR_RETRY_BASE_DELAY_MS: '1',
  MUGLOAR_RATE_PER_SECOND: '1000',
  MUGLOAR_BURST: '1000',
};

export default defineConfig({
  test: {
    env: MUGLOAR_TEST_ENV,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/unit/**/*.test.ts'] } },
      { extends: true, test: { name: 'contract', include: ['test/contract/**/*.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          // One schema, shared by every integration file; run them serially.
          fileParallelism: false,
          env: { ...MUGLOAR_TEST_ENV, DATABASE_URL: TEST_DATABASE_URL },
        },
      },
    ],
  },
});
