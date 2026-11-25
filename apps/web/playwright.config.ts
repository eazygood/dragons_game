import { defineConfig, devices } from '@playwright/test';

const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_PORT = 4173;
const BASE_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const SERVER_START_TIMEOUT_MS = 120_000;

const BROWSERS = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
  { name: 'webkit', device: devices['Desktop Safari'] },
];

// 360px is the narrowest width the layout promises to support (docs/agent_docs/frontend.md).
const VIEWPORTS = [
  { name: 'phone', viewport: { width: 360, height: 740 } },
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
];

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: BROWSERS.flatMap(({ name: browserName, device }) =>
    VIEWPORTS.map(({ name: viewportName, viewport }) => ({
      name: `${browserName}-${viewportName}`,
      use: { ...device, viewport },
    })),
  ),
  // The built bundle is what ships, so the specs run against it rather than the dev server.
  webServer: {
    command: `pnpm build && pnpm preview --host ${PREVIEW_HOST} --port ${PREVIEW_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: SERVER_START_TIMEOUT_MS,
  },
});
