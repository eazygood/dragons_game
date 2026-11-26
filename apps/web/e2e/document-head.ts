import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const TITLE_SEPARATOR = ' · ';
const APP_TITLE = 'Dragons of Mugloar';

// Browsers read the first <title>, so a static one beside the router's would silently win on
// every route; index.html has none, and the count keeps it that way.
export const expectDocumentTitle = async ({
  page,
  routeTitle,
}: {
  page: Page;
  routeTitle: string;
}) => {
  await expect(page).toHaveTitle(`${routeTitle}${TITLE_SEPARATOR}${APP_TITLE}`);
  await expect(page.locator('title')).toHaveCount(1);
};
