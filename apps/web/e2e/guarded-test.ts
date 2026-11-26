import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

import { API_ROUTE_PATTERN, requestKey } from './api-fixtures.ts';

export { expect };

const CSP_REPORT_BINDING = 'reportCspViolation';

type CspReportingWindow = { [CSP_REPORT_BINDING]: (summary: string) => void };

// The preview server sends the same policy as production, so a blocked script, style or
// eval shows up here instead of in a user's console.
const collectCspViolations = async ({ page }: { page: Page }) => {
  const violations: string[] = [];

  await page.exposeFunction(CSP_REPORT_BINDING, (summary: string) => violations.push(summary));
  await page.addInitScript<typeof CSP_REPORT_BINDING>((binding) => {
    document.addEventListener('securitypolicyviolation', ({ violatedDirective, blockedURI }) =>
      (window as unknown as CspReportingWindow)[binding](
        `${violatedDirective} blocked ${blockedURI}`,
      ),
    );
  }, CSP_REPORT_BINDING);

  return violations;
};

// Registered first, so it is the last route a request reaches: `routeApi` layers on top and
// falls back to it. `providePage` is not `use` because react-hooks/rules-of-hooks flags that
// name.
export const test = base.extend({
  page: async ({ page }, providePage) => {
    const unroutedRequests = new Set<string>();
    const cspViolations = await collectCspViolations({ page });

    await page.route(API_ROUTE_PATTERN, async (route) => {
      unroutedRequests.add(requestKey({ request: route.request() }));
      await route.abort();
    });

    await providePage(page);

    const unrouted = [...unroutedRequests];

    expect(unrouted, `Unrouted API requests:\n${unrouted.join('\n')}`).toEqual([]);
    expect(cspViolations, `CSP violations:\n${cspViolations.join('\n')}`).toEqual([]);
  },
});
