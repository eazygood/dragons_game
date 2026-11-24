import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

type RenderOptions = { queryClient?: QueryClient };

// Mirrors Testing Library's render(ui, options) so call sites read the same.
export const renderWithQuery = (
  ui: ReactElement,
  { queryClient = createTestQueryClient() }: RenderOptions = {},
) => {
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
};

// For components that render <Link>; the router mounts asynchronously, so query with findBy.
export const renderInRouter = (ui: ReactElement, options: RenderOptions = {}) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  return renderWithQuery(<RouterProvider router={router} />, options);
};
