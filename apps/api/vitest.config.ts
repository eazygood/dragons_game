import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'mysql://dragon:dragon@127.0.0.1:3306/dragon_test';

export default defineConfig({
  test: {
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
          env: { DATABASE_URL: TEST_DATABASE_URL },
        },
      },
    ],
  },
});
