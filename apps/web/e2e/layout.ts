import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const expectNoHorizontalOverflow = async ({ page }: { page: Page }) => {
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );

  expect(fitsViewport).toBe(true);
};
