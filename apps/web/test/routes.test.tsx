import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { copy } from '../src/features/play/copy.ts';
import { watchCopy } from '../src/features/watch/watch-copy.ts';
import { routeTree } from '../src/routeTree.gen.ts';
import { jsonResponse, respondOk, stubApi } from './fetch-stub.ts';
import { GAME_VIEW, SHOW_MOVES, SOLVE_MOVE, buildGameView } from './fixtures.ts';
import { renderWithQuery } from './render.tsx';

const NEXT_BOT_GAME = { ...GAME_VIEW, state: { ...GAME_VIEW.state, gameId: 'g2' } };

const renderRoute = ({ path }: { path: string }) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  renderWithQuery(<RouterProvider router={router} />);

  return router;
};

describe('routes', () => {
  it('sends the landing page to /play', async () => {
    const router = renderRoute({ path: '/' });

    expect(await screen.findByRole('heading', { name: copy.start.title })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/play');
  });

  it('opens the watch page once the bot game has started', async () => {
    const finished = buildGameView({ status: 'abandoned', score: 1240 });

    stubApi({
      'POST /api/bot-games': () => jsonResponse({ status: 201, body: GAME_VIEW }),
      'GET /api/games/g1': respondOk({ body: finished }),
    });
    const router = renderRoute({ path: '/play' });

    await userEvent.click(await screen.findByRole('button', { name: copy.start.botPlay }));

    expect(await screen.findByText(watchCopy.reachedTarget(1240))).toBeVisible();
    expect(router.state.location.pathname).toBe('/watch/g1');
  });

  it('refuses a malformed id on the watch page without asking the API', async () => {
    const api = stubApi({});

    renderRoute({ path: '/watch/not.an.id' });

    expect(
      await screen.findByRole('heading', { name: copy.unavailableGame.invalid_id.title }),
    ).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });

  describe('Run the bot again', () => {
    const stubFinishedGameAndNextBotGame = () =>
      stubApi({
        'GET /api/games/g1': respondOk({
          body: buildGameView({ status: 'abandoned', score: 1240 }),
        }),
        'GET /api/games/g1/moves': respondOk({ body: [SOLVE_MOVE] }),
        'POST /api/bot-games': () => jsonResponse({ status: 201, body: NEXT_BOT_GAME }),
        'GET /api/games/g2': respondOk({ body: NEXT_BOT_GAME }),
      });

    it('starts one new bot game and opens its watch view', async () => {
      const api = stubFinishedGameAndNextBotGame();
      const router = renderRoute({ path: '/watch/g1' });

      await userEvent.dblClick(await screen.findByRole('button', { name: watchCopy.runAgain }));

      expect(await screen.findByText(watchCopy.inProgress)).toBeVisible();
      expect(router.state.location.pathname).toBe('/watch/g2');
      expect(api.callCountOf('POST /api/bot-games')).toBe(1);
    });

    it('hides the moves again on the new game', async () => {
      stubFinishedGameAndNextBotGame();
      renderRoute({ path: '/watch/g1' });
      await userEvent.click(await screen.findByRole('checkbox', { name: SHOW_MOVES }));
      await screen.findByRole('list');

      await userEvent.click(screen.getByRole('button', { name: watchCopy.runAgain }));
      await screen.findByText(watchCopy.inProgress);

      expect(screen.getByRole('checkbox', { name: SHOW_MOVES })).not.toBeChecked();
      expect(screen.queryByRole('list')).toBeNull();
    });
  });
});
