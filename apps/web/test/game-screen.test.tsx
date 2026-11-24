import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { copy } from '../src/features/play/copy.ts';
import { GameScreen } from '../src/features/play/game/GameScreen.tsx';
import { jsonResponse, stubApi } from './fetch-stub.ts';
import { GAME_VIEW, TURN_VIEW } from './fixtures.ts';
import { renderInRouter } from './render.tsx';

describe('GameScreen', () => {
  it('shows the game over screen for a finished game', async () => {
    stubApi({
      'GET /api/games/g1': () =>
        jsonResponse({ status: 200, body: { ...GAME_VIEW, status: 'game_over' } }),
    });

    renderInRouter(<GameScreen gameId="g1" />);

    expect(await screen.findByRole('heading', { name: copy.gameOver.title })).toBeVisible();
    expect(screen.getByRole('link', { name: copy.gameOver.newGame })).toHaveAttribute(
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
    expect(screen.getByText(copy.status.score)).toBeVisible();
  });

  it('says there is no such game, without a retry, when the id is unknown', async () => {
    stubApi({
      'GET /api/games/g1': () =>
        jsonResponse({ status: 404, body: { error: { code: 'not_found', message: 'none' } } }),
    });

    renderInRouter(<GameScreen gameId="g1" />);

    expect(
      await screen.findByRole('heading', { name: copy.unavailableGame.not_found.title }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: copy.unavailableGame.back })).toHaveAttribute(
      'href',
      '/play',
    );
    expect(screen.queryByRole('button', { name: copy.errors.retry })).toBeNull();
  });

  it('says the game belongs to the bot when its turn is refused', async () => {
    stubApi({
      'GET /api/games/g1': () => jsonResponse({ status: 200, body: GAME_VIEW }),
      'GET /api/games/g1/turn': () =>
        jsonResponse({ status: 409, body: { error: { code: 'conflict', message: 'bot' } } }),
    });

    renderInRouter(<GameScreen gameId="g1" />);

    expect(
      await screen.findByRole('heading', { name: copy.unavailableGame.bot_game.title }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: copy.unavailableGame.watchBot })).toHaveAttribute(
      'href',
      '/watch/g1',
    );
    expect(screen.queryByRole('button', { name: copy.errors.retry })).toBeNull();
  });
});
