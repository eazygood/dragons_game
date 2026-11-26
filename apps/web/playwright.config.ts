import { defineConfig, devices } from '@playwright/test';

const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_PORT = 4173;
const BASE_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const SERVER_START_TIMEOUT_MS = 120_000;

// Playwright rejects isMobile and hasTouch on Firefox, so its phone project only narrows the window.
const BROWSERS = [
  { name: 'chromium', device: devices['Desktop Chrome'], canEmulateMobile: true },
  { name: 'firefox', device: devices['Desktop Firefox'], canEmulateMobile: false },
  { name: 'webkit', device: devices['Desktop Safari'], canEmulateMobile: true },
];

// 360px is the narrowest width the layout promises to support (docs/agent_docs/frontend.md).
// 768px sits between it and the 960px breakpoint where the board and the shop go side by side.
const VIEWPORTS = [
  { name: 'phone', viewport: { width: 360, height: 740 }, isMobile: true },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: false },
  { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false },
];

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: BROWSERS.flatMap(({ name: browserName, device, canEmulateMobile }) =>
    VIEWPORTS.map(({ name: viewportName, viewport, isMobile }) => ({
      name: `${browserName}-${viewportName}`,
      use: {
        ...device,
        viewport,
        ...(isMobile && canEmulateMobile && { isMobile: true, hasTouch: true }),
      },
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
