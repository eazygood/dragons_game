import { createRouter } from '@tanstack/react-router';
import type { RouterHistory } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen.ts';
import { NotFoundScreen, RouteErrorScreen } from './shared/RouteFallbacks.tsx';

export const createAppRouter = ({ history }: { history?: RouterHistory } = {}) =>
  createRouter({
    routeTree,
    history,
    defaultNotFoundComponent: NotFoundScreen,
    defaultErrorComponent: RouteErrorScreen,
  });

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
