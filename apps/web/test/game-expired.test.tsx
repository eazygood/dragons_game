import { act, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { gameKeys } from '../src/api/game-queries.ts';
import { GameScreen } from '../src/features/play/game/GameScreen.tsx';
import { sharedCopy } from '../src/shared/shared-copy.ts';
import { respondInSequence, respondOk, respondWith, stubApi } from './fetch-stub.ts';
import { GAME_VIEW, TURN_VIEW } from './fixtures.ts';
import { renderInRouter } from './render.tsx';

// The shape the API answers when the Mugloar server has dropped an idle game it still lists.
const FORGOTTEN_GAME_RESPONSE = respondWith({
  status: 404,
  body: { error: { code: 'not_found', message: 'The Mugloar server does not know this game' } },
});

const expectExpiredNotice = async () => {
  const heading = await screen.findByRole('heading', {
    name: sharedCopy.unavailableGame.expired.title,
  });

  expect(heading).toHaveFocus();
  expect(screen.getByText(sharedCopy.unavailableGame.expired.body)).toBeVisible();
  expect(
    screen.getByRole('link', { name: sharedCopy.unavailableGame.startNewGame }),
  ).toHaveAttribute('href', '/play');
  expect(screen.queryByRole('button', { name: sharedCopy.errors.retry })).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText(sharedCopy.errors.unexpected)).toBeNull();
};

describe('GameScreen when the game server has forgotten the game', () => {
  it('says the game has expired, with a way to start over and no retry', async () => {
    stubApi({
      'GET /api/games/g1': respondOk({ body: GAME_VIEW }),
      'GET /api/games/g1/turn': FORGOTTEN_GAME_RESPONSE,
    });

    renderInRouter(<GameScreen gameId="g1" />);

    await expectExpiredNotice();
  });

  it('replaces a board already on screen when a later refresh finds the game forgotten', async () => {
    stubApi({
      'GET /api/games/g1': respondOk({ body: GAME_VIEW }),
      'GET /api/games/g1/turn': respondInSequence({
        responders: [respondOk({ body: TURN_VIEW }), FORGOTTEN_GAME_RESPONSE],
      }),
    });

    const { queryClient } = renderInRouter(<GameScreen gameId="g1" />);

    await screen.findAllByRole('article');
    await act(() => queryClient.invalidateQueries({ queryKey: gameKeys.turn('g1') }));

    await expectExpiredNotice();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });
});
