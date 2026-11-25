import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppRouter } from '../src/router.tsx';
import { sharedCopy } from '../src/shared/shared-copy.ts';
import { renderWithQuery } from './render.tsx';

const RECOVERED_TEXT = 'recovered';
const crash = vi.hoisted(() => ({ isCrashing: true }));

// The real routes catch every API error themselves, so only a render bug reaches the fallback.
vi.mock('../src/features/play/game/GameScreen.tsx', () => ({
  GameScreen: () => {
    if (crash.isCrashing) {
      throw new Error('render bug');
    }

    return <p>{RECOVERED_TEXT}</p>;
  },
}));

describe('route error fallback', () => {
  beforeEach(() => {
    crash.isCrashing = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a retryable notice instead of a blank page when a route crashes', async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ['/play/g1'] }),
    });

    renderWithQuery(<RouterProvider router={router} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(sharedCopy.errors.unexpected);

    crash.isCrashing = false;
    await userEvent.click(screen.getByRole('button', { name: sharedCopy.errors.retry }));

    expect(await screen.findByText(RECOVERED_TEXT)).toBeVisible();
  });
});
