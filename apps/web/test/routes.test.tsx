import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { copy } from '../src/features/play/copy.ts';
import { routeTree } from '../src/routeTree.gen.ts';
import { renderWithQuery } from './render.tsx';

describe('routes', () => {
  it('sends the landing page to /play', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    renderWithQuery(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: copy.start.title })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/play');
  });
});
