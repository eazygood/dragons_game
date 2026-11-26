import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { playCopy } from '../src/features/play/play-copy.ts';
import { sharedCopy } from '../src/shared/shared-copy.ts';
import { watchCopy } from '../src/features/watch/watch-copy.ts';
import { createAppRouter } from '../src/router.tsx';
import { jsonResponse, respondNever, respondOk, stubApi } from './fetch-stub.ts';
import { GAME_VIEW, SHOW_MOVES, SOLVE_MOVE, TURN_VIEW, buildGameView } from './fixtures.ts';
import { renderWithQuery } from './render.tsx';

const NEXT_BOT_GAME = { ...GAME_VIEW, state: { ...GAME_VIEW.state, gameId: 'g2' } };

const titleOf = ({ page }: { page: string }) => `${page} · ${sharedCopy.appTitle}`;

const renderRoute = ({ path }: { path: string }) => {
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) });

  renderWithQuery(<RouterProvider router={router} />);

  return router;
};

describe('routes', () => {
  it('sends the landing page to /play', async () => {
    const router = renderRoute({ path: '/' });

    expect(await screen.findByRole('heading', { name: playCopy.start.title })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/play');
  });

  it('opens the watch page once the bot game has started', async () => {
    stubApi({
      'POST /api/bot-games': () => jsonResponse({ status: 201, body: GAME_VIEW }),
      'GET /api/games/g1': respondOk({ body: GAME_VIEW }),
    });
    const router = renderRoute({ path: '/play' });

    await userEvent.click(await screen.findByRole('button', { name: playCopy.start.botPlay }));

    expect(await screen.findByText(watchCopy.inProgress)).toBeVisible();
    expect(router.state.location.pathname).toBe('/watch/g1');
  });

  it('refuses a malformed id on the watch page without asking the API', async () => {
    const api = stubApi({});

    renderRoute({ path: '/watch/not.an.id' });

    expect(
      await screen.findByRole('heading', { name: sharedCopy.unavailableGame.invalid_id.title }),
    ).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });

  it('shows a way back for an address that matches no route', async () => {
    renderRoute({ path: '/no/such/page' });

    expect(
      await screen.findByRole('heading', { name: sharedCopy.routeFallback.notFoundTitle }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: sharedCopy.backToStart })).toHaveAttribute(
      'href',
      '/play',
    );
  });

  it.each([
    { path: '/no/such/page', heading: sharedCopy.routeFallback.notFoundTitle },
    { path: '/watch/not.an.id', heading: sharedCopy.unavailableGame.invalid_id.title },
  ])(
    'moves focus to the heading of $path, because a navigation keeps focus on the old page',
    async ({ path, heading }) => {
      renderRoute({ path });

      expect(await screen.findByRole('heading', { name: heading })).toHaveFocus();
    },
  );

  it('takes the player home from the page title', async () => {
    const router = renderRoute({ path: '/watch/not.an.id' });

    await screen.findByRole('heading', { name: sharedCopy.unavailableGame.invalid_id.title });

    const titleHeading = screen.getByRole('heading', { level: 1 });

    await userEvent.click(within(titleHeading).getByRole('link', { name: sharedCopy.appTitle }));

    expect(await screen.findByRole('heading', { name: playCopy.start.title })).toBeVisible();
    expect(router.state.location.pathname).toBe('/play');
  });

  it('opens a new game from the cache the start request seeded, without refetching it', async () => {
    const api = stubApi({
      'POST /api/games': () => jsonResponse({ status: 201, body: GAME_VIEW }),
      'GET /api/games/g1': respondNever(),
      'GET /api/games/g1/turn': respondOk({ body: TURN_VIEW }),
    });
    const router = renderRoute({ path: '/play' });

    await userEvent.click(await screen.findByRole('button', { name: playCopy.start.newGame }));

    expect(await screen.findAllByRole('article')).toHaveLength(TURN_VIEW.board.length);
    expect(screen.queryByText(sharedCopy.game.loading)).toBeNull();
    expect(api.callCountOf('GET /api/games/g1')).toBe(0);
    expect(router.state.location.pathname).toBe('/play/g1');
  });

  it('hides the moves again on the next bot game', async () => {
    stubApi({
      'GET /api/games/g1': respondOk({ body: buildGameView({ status: 'abandoned', score: 1240 }) }),
      'GET /api/games/g1/moves': respondOk({ body: [SOLVE_MOVE] }),
      'POST /api/bot-games': () => jsonResponse({ status: 201, body: NEXT_BOT_GAME }),
      'GET /api/games/g2': respondOk({ body: NEXT_BOT_GAME }),
    });
    renderRoute({ path: '/watch/g1' });
    await userEvent.click(await screen.findByRole('checkbox', { name: SHOW_MOVES }));
    await screen.findByRole('list');

    await userEvent.click(screen.getByRole('button', { name: watchCopy.runAgain }));
    await screen.findByText(watchCopy.inProgress);

    expect(screen.getByRole('checkbox', { name: SHOW_MOVES })).not.toBeChecked();
    expect(screen.queryByRole('list')).toBeNull();
  });

  describe('the document title', () => {
    it('names the page on the start screen and the watch screen, and keeps one title element', async () => {
      stubApi({
        'POST /api/bot-games': () => jsonResponse({ status: 201, body: GAME_VIEW }),
        'GET /api/games/g1': respondOk({ body: GAME_VIEW }),
      });
      renderRoute({ path: '/play' });

      await waitFor(() => expect(document.title).toBe(titleOf({ page: playCopy.start.title })));

      await userEvent.click(await screen.findByRole('button', { name: playCopy.start.botPlay }));

      await waitFor(() => expect(document.title).toBe(titleOf({ page: watchCopy.title })));
      expect(document.querySelectorAll('title')).toHaveLength(1);
    });

    it('falls back to the app name on a page that has no title of its own', async () => {
      renderRoute({ path: '/no/such/page' });

      await screen.findByRole('heading', { name: sharedCopy.routeFallback.notFoundTitle });

      expect(document.title).toBe(sharedCopy.appTitle);
    });
  });
});
