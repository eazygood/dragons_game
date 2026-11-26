import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { playCopy } from '../src/features/play/play-copy.ts';
import { sharedCopy } from '../src/shared/shared-copy.ts';
import { GameScreen } from '../src/features/play/game/GameScreen.tsx';
import { ShopPanel } from '../src/features/play/shop/ShopPanel.tsx';
import { createQueryClient } from '../src/query-client.ts';
import { respondInSequence, respondOk, respondWith, stubApi } from './fetch-stub.ts';
import { GAME_VIEW, IDLE_MOVE_ACTIONS, MOVE_MESSAGE, MOVE_RESULT, TURN_VIEW } from './fixtures.ts';
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

    await waitFor(() =>
      expect(screen.getByRole('status', { name: playCopy.moves.label })).toHaveTextContent(
        MOVE_MESSAGE,
      ),
    );
    await waitFor(() => expect(api.callCountOf(TURN_ROUTE)).toBe(2));
  });

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

    expect(await screen.findByText(playCopy.moves.adExpired)).toBeVisible();
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

    expect(await screen.findByText(sharedCopy.errors.upstreamUnavailable)).toBeVisible();
    expect(api.callCountOf(SOLVE_ROUTE)).toBe(1);
  });

  it('disables a purchase the player cannot afford and says why', () => {
    renderWithQuery(
      <ShopPanel shop={[...RECORDED_SHOP_ITEMS]} gold={40} moveActions={IDLE_MOVE_ACTIONS} />,
    );

    const buyButton = screen.getByRole('button', { name: /buy healing potion/i });

    expect(buyButton).toBeDisabled();
    expect(screen.getByText(playCopy.shop.needMoreGold(10))).toBeVisible();
    expect(buyButton).toHaveAccessibleDescription(playCopy.shop.needMoreGold(10));
  });

  it('says so when the shop has nothing for sale', () => {
    renderWithQuery(<ShopPanel shop={[]} gold={40} moveActions={IDLE_MOVE_ACTIONS} />);

    expect(screen.getByText(playCopy.shop.empty)).toBeVisible();
  });

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

    expect(await screen.findByRole('heading', { name: playCopy.gameOver.title })).toBeVisible();
  });

  it('turns a 410 on the move itself into the game over screen', async () => {
    stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [respondOk({ body: GAME_VIEW }), respondOk({ body: FINISHED_GAME })],
      }),
      [TURN_ROUTE]: respondOk({ body: TURN_VIEW }),
      [SOLVE_ROUTE]: respondWith({
        status: 410,
        body: { error: { code: 'game_over', message: 'Game over' } },
      }),
    });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    expect(await screen.findByRole('heading', { name: playCopy.gameOver.title })).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
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

    expect(await screen.findByRole('heading', { name: playCopy.gameOver.title })).toBeVisible();
  });

  it('tells the player to wait when a move is rate limited, and keeps the board', async () => {
    const api = stubApi({
      ...activeGameRoutes,
      [SOLVE_ROUTE]: respondWith({
        status: 429,
        body: { error: { code: 'too_many_requests', message: 'slow down' } },
      }),
    });

    renderInRouter(<GameScreen gameId="g1" />, { queryClient: createQueryClient() });
    await clickSolve();

    expect(await screen.findByRole('status', { name: playCopy.moves.label })).toHaveTextContent(
      sharedCopy.errors.tooManyRequests,
    );
    expect(screen.getAllByRole('article')).toHaveLength(TURN_VIEW.board.length);
    expect(api.callCountOf(SOLVE_ROUTE)).toBe(1);
  });
});
