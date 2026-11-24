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

// Mirrors Testing Library's render(ui) so call sites read the same.
export const renderWithQuery = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();

  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
};

// For components that render <Link>; the router mounts asynchronously, so query with findBy.
export const renderInRouter = (ui: ReactElement) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  return renderWithQuery(<RouterProvider router={router} />);
};
