import { expect, test as base } from '@playwright/test';

import { API_ROUTE_PATTERN, requestKey } from './api-fixtures.ts';

export { expect };

// Registered first, so it is the last route a request reaches: `routeApi` layers on top and
// falls back to it. `providePage` is not `use` because react-hooks/rules-of-hooks flags that
// name.
export const test = base.extend({
  page: async ({ page }, providePage) => {
    const unroutedRequests = new Set<string>();

    await page.route(API_ROUTE_PATTERN, async (route) => {
      unroutedRequests.add(requestKey({ request: route.request() }));
      await route.abort();
    });

    await providePage(page);

    const unrouted = [...unroutedRequests];

    expect(unrouted, `Unrouted API requests:\n${unrouted.join('\n')}`).toEqual([]);
  },
});
