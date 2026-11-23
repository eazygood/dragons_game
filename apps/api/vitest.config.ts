import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/unit/**/*.test.ts'] } },
      { extends: true, test: { name: 'contract', include: ['test/contract/**/*.test.ts'] } },
    ],
  },
});
