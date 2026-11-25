import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { playCopy } from '../src/features/play/play-copy.ts';
import { sharedCopy } from '../src/shared/shared-copy.ts';
import { gameKeys } from '../src/api/game-queries.ts';
import { GameScreen } from '../src/features/play/game/GameScreen.tsx';
import { jsonResponse, respondInSequence, respondOk, respondWith, stubApi } from './fetch-stub.ts';
import { GAME_VIEW, TURN_VIEW } from './fixtures.ts';
import { renderInRouter } from './render.tsx';

describe('GameScreen', () => {
  it('shows the game over screen for a finished game', async () => {
    stubApi({
      'GET /api/games/g1': () =>
        jsonResponse({ status: 200, body: { ...GAME_VIEW, status: 'game_over' } }),
    });

    renderInRouter(<GameScreen gameId="g1" />);

    expect(await screen.findByRole('heading', { name: playCopy.gameOver.title })).toBeVisible();
    expect(screen.getByRole('link', { name: playCopy.gameOver.newGame })).toHaveAttribute(
      'href',
      '/play',
    );
  });

  it('shows the advised board for an active game', async () => {
    stubApi({
      'GET /api/games/g1': () => jsonResponse({ status: 200, body: GAME_VIEW }),
      'GET /api/games/g1/turn': () => jsonResponse({ status: 200, body: TURN_VIEW }),
    });

    renderInRouter(<GameScreen gameId="g1" />);

    expect(await screen.findAllByRole('article')).toHaveLength(TURN_VIEW.board.length);
    expect(screen.getByText(sharedCopy.status.score)).toBeVisible();
  });

  it('says there is no such game, without a retry, when the id is unknown', async () => {
    stubApi({
      'GET /api/games/g1': () =>
        jsonResponse({ status: 404, body: { error: { code: 'not_found', message: 'none' } } }),
    });

    renderInRouter(<GameScreen gameId="g1" />);

    expect(
      await screen.findByRole('heading', { name: sharedCopy.unavailableGame.not_found.title }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: sharedCopy.unavailableGame.back })).toHaveAttribute(
      'href',
      '/play',
    );
    expect(screen.queryByRole('button', { name: sharedCopy.errors.retry })).toBeNull();
  });

  it('says the game belongs to the bot when its turn is refused', async () => {
    stubApi({
      'GET /api/games/g1': () => jsonResponse({ status: 200, body: GAME_VIEW }),
      'GET /api/games/g1/turn': () =>
        jsonResponse({ status: 409, body: { error: { code: 'conflict', message: 'bot' } } }),
    });

    renderInRouter(<GameScreen gameId="g1" />);

    expect(
      await screen.findByRole('heading', { name: sharedCopy.unavailableGame.bot_game.title }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: sharedCopy.unavailableGame.watchBot })).toHaveAttribute(
      'href',
      '/watch/g1',
    );
    expect(screen.queryByRole('button', { name: sharedCopy.errors.retry })).toBeNull();
  });

  it('moves focus to the game over heading, because the swap unmounts the live region', async () => {
    stubApi({
      'GET /api/games/g1': respondOk({ body: { ...GAME_VIEW, status: 'game_over' } }),
    });

    renderInRouter(<GameScreen gameId="g1" />);

    expect(await screen.findByRole('heading', { name: playCopy.gameOver.title })).toHaveFocus();
  });

  it('keeps the last board and says the refresh failed when a background refetch fails', async () => {
    stubApi({
      'GET /api/games/g1': respondInSequence({
        responders: [
          respondOk({ body: GAME_VIEW }),
          respondWith({
            status: 502,
            body: { error: { code: 'upstream_unavailable', message: 'down' } },
          }),
        ],
      }),
      'GET /api/games/g1/turn': respondOk({ body: TURN_VIEW }),
    });

    const { queryClient } = renderInRouter(<GameScreen gameId="g1" />);

    await screen.findAllByRole('article');
    await act(() => queryClient.invalidateQueries({ queryKey: gameKeys.all('g1') }));

    expect(await screen.findByText(sharedCopy.errors.refreshFailed)).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(TURN_VIEW.board.length);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not show the refresh hint while every request succeeds', async () => {
    stubApi({
      'GET /api/games/g1': respondOk({ body: GAME_VIEW }),
      'GET /api/games/g1/turn': respondOk({ body: TURN_VIEW }),
    });

    renderInRouter(<GameScreen gameId="g1" />);
    await screen.findAllByRole('article');

    expect(screen.queryByText(sharedCopy.errors.refreshFailed)).toBeNull();
  });
});
