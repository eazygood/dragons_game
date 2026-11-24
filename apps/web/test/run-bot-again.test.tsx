import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { copy } from '../src/features/play/copy.ts';
import { watchCopy } from '../src/features/watch/watch-copy.ts';
import { WatchScreen } from '../src/features/watch/WatchScreen.tsx';
import { jsonResponse, respondNever, respondOk, stubApi } from './fetch-stub.ts';
import type { StubbedRoutes } from './fetch-stub.ts';
import { ABOVE_TARGET, GAME_ID, GAME_ROUTE, GAME_VIEW, buildGameView } from './fixtures.ts';
import { renderInRouter } from './render.tsx';

const BOT_GAMES_ROUTE = 'POST /api/bot-games';

const renderFinishedGame = ({ botGames }: { botGames: StubbedRoutes[string] }) => {
  const api = stubApi({
    [GAME_ROUTE]: respondOk({ body: buildGameView({ status: 'abandoned', score: ABOVE_TARGET }) }),
    [BOT_GAMES_ROUTE]: botGames,
  });

  renderInRouter(<WatchScreen gameId={GAME_ID} />);

  return api;
};

const findRunAgainButton = () => screen.findByRole('button', { name: watchCopy.runAgain });

describe('Run the bot again', () => {
  it('sends one bot game request when the button is clicked twice quickly', async () => {
    const api = renderFinishedGame({ botGames: respondNever() });

    await userEvent.dblClick(await findRunAgainButton());

    expect(await screen.findByRole('button', { name: watchCopy.runAgainStarting })).toBeDisabled();
    expect(api.callCountOf(BOT_GAMES_ROUTE)).toBe(1);
  });

  // Navigation commits after the mutation settles; the button must not re-enable in that gap.
  it('stays disabled once the new bot game has started', async () => {
    const api = renderFinishedGame({
      botGames: () => jsonResponse({ status: 201, body: GAME_VIEW }),
    });

    await userEvent.click(await findRunAgainButton());
    await waitFor(() => expect(api.callCountOf(BOT_GAMES_ROUTE)).toBe(1));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: watchCopy.runAgain })).toBeDisabled(),
    );
  });

  it('says why the bot could not start and lets the viewer try again', async () => {
    renderFinishedGame({
      botGames: () =>
        jsonResponse({
          status: 502,
          body: { error: { code: 'upstream_unavailable', message: 'down' } },
        }),
    });

    await userEvent.click(await findRunAgainButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.upstreamUnavailable);
    expect(screen.getByRole('button', { name: watchCopy.runAgain })).toBeEnabled();
  });
});
