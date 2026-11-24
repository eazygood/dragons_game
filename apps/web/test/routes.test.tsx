import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { routeTree } from '../src/routeTree.gen.ts';

describe('routes', () => {
  it('sends the landing page to /play', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Play' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/play');
  });
});
