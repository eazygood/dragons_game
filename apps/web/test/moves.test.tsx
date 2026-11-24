import { SHOP_ITEM_PRIOR } from '@bigbank-dragon/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { copy } from '../src/features/play/copy.ts';
import { GameScreen } from '../src/features/play/game/GameScreen.tsx';
import { ShopPanel } from '../src/features/play/shop/ShopPanel.tsx';
import { createQueryClient } from '../src/query-client.ts';
import { respondInSequence, respondNever, respondOk, respondWith, stubApi } from './fetch-stub.ts';
import { GAME_VIEW, IDLE_MOVES, MOVE_RESULT, TURN_VIEW } from './fixtures.ts';
import { renderInRouter, renderWithQuery } from './render.tsx';

const GAME_ROUTE = 'GET /api/games/g1';
const TURN_ROUTE = 'GET /api/games/g1/turn';
const SOLVE_ROUTE = 'POST /api/games/g1/ads/sure1/solve';
const SOLVE_BUTTON = /solve: help defend the village/i;
const FINISHED_GAME = { ...GAME_VIEW, status: 'game_over' };

const activeGameRoutes = {
  [GAME_ROUTE]: respondOk({ body: GAME_VIEW }),
  [TURN_ROUTE]: respondOk({ body: TURN_VIEW }),
};

const clickSolve = async () =>
  userEvent.click(await screen.findByRole('button', { name: SOLVE_BUTTON }));

describe('player moves', () => {
  it('solves an ad and refetches the turn', async () => {
    const api = stubApi({ ...activeGameRoutes, [SOLVE_ROUTE]: respondOk({ body: MOVE_RESULT }) });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MOVE_RESULT.message!));
    await waitFor(() => expect(api.callCountOf(TURN_ROUTE)).toBe(2));
  });

  // Review Focus #1 (client half)
  it('disables every move while one is in flight', async () => {
    stubApi({ ...activeGameRoutes, [SOLVE_ROUTE]: respondNever() });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    for (const button of screen.getAllByRole('button', { name: /solve|buy/i })) {
      expect(button).toBeDisabled();
    }
  });

  // Review Focus #2 (client half)
  it('explains an expired ad and refreshes the board', async () => {
    const api = stubApi({
      ...activeGameRoutes,
      [SOLVE_ROUTE]: respondWith({
        status: 409,
        body: { error: { code: 'conflict', message: 'expired' } },
      }),
    });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    expect(await screen.findByText(copy.moves.adExpired)).toBeVisible();
    await waitFor(() => expect(api.callCountOf(TURN_ROUTE)).toBe(2));
  });

  it('never retries a move that failed upstream', async () => {
    const api = stubApi({
      ...activeGameRoutes,
      [SOLVE_ROUTE]: respondWith({
        status: 502,
        body: { error: { code: 'upstream_unavailable', message: 'down' } },
      }),
    });

    renderInRouter(<GameScreen gameId="g1" />, { queryClient: createQueryClient() });
    await clickSolve();

    expect(await screen.findByText(copy.errors.upstreamUnavailable)).toBeVisible();
    expect(api.callCountOf(SOLVE_ROUTE)).toBe(1);
  });

  // Review Focus #3 (client half)
  it('disables a purchase the player cannot afford and says why', () => {
    renderWithQuery(<ShopPanel shop={[...SHOP_ITEM_PRIOR]} gold={40} moves={IDLE_MOVES} />);

    expect(screen.getByRole('button', { name: /buy healing potion/i })).toBeDisabled();
    expect(screen.getByText(copy.shop.needMoreGold(10))).toBeVisible();
  });

  // Review Focus #5 (client half)
  it('shows the game over screen when a move ends the game', async () => {
    stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [respondOk({ body: GAME_VIEW }), respondOk({ body: FINISHED_GAME })],
      }),
      [TURN_ROUTE]: respondOk({ body: TURN_VIEW }),
      [SOLVE_ROUTE]: respondOk({
        body: {
          ...MOVE_RESULT,
          success: false,
          game: { ...MOVE_RESULT.game, status: 'game_over' },
        },
      }),
    });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    expect(await screen.findByRole('heading', { name: copy.gameOver.title })).toBeVisible();
  });

  it('turns a 410 on the turn into the game over screen', async () => {
    stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [respondOk({ body: GAME_VIEW }), respondOk({ body: FINISHED_GAME })],
      }),
      [TURN_ROUTE]: respondWith({
        status: 410,
        body: { error: { code: 'game_over', message: 'Game over' } },
      }),
    });

    renderInRouter(<GameScreen gameId="g1" />, { queryClient: createQueryClient() });

    expect(await screen.findByRole('heading', { name: copy.gameOver.title })).toBeVisible();
  });

  it('offers a retry when the game cannot be loaded', async () => {
    stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [
          respondWith({
            status: 502,
            body: { error: { code: 'upstream_unavailable', message: 'down' } },
          }),
          respondOk({ body: FINISHED_GAME }),
        ],
      }),
    });

    renderInRouter(<GameScreen gameId="g1" />);
    await userEvent.click(await screen.findByRole('button', { name: copy.errors.retry }));

    expect(await screen.findByRole('heading', { name: copy.gameOver.title })).toBeVisible();
  });
});
