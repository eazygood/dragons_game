import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { playCopy } from '../src/features/play/play-copy.ts';
import { GameScreen } from '../src/features/play/game/GameScreen.tsx';
import { respondInSequence, respondNever, respondOk, stubApi } from './fetch-stub.ts';
import { GAME_VIEW, MOVE_RESULT, TURN_VIEW } from './fixtures.ts';
import { renderInRouter } from './render.tsx';

const GAME_ROUTE = 'GET /api/games/g1';
const TURN_ROUTE = 'GET /api/games/g1/turn';
const SOLVE_ROUTE = 'POST /api/games/g1/ads/sure1/solve';
const SOLVE_BUTTON = /solve: help defend the village/i;

const activeGameRoutes = {
  [GAME_ROUTE]: respondOk({ body: GAME_VIEW }),
  [TURN_ROUTE]: respondOk({ body: TURN_VIEW }),
};

const clickSolve = async () =>
  userEvent.click(await screen.findByRole('button', { name: SOLVE_BUTTON }));

describe('a move in flight', () => {
  it('moves focus to the feedback region when a move is submitted', async () => {
    stubApi({ ...activeGameRoutes, [SOLVE_ROUTE]: respondNever() });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    expect(screen.getByRole('status', { name: playCopy.moves.label })).toHaveFocus();
  });

  it('disables every move while one is in flight', async () => {
    stubApi({ ...activeGameRoutes, [SOLVE_ROUTE]: respondNever() });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    for (const button of screen.getAllByRole('button', { name: /solve|buy/i })) {
      expect(button).toBeDisabled();
    }
  });

  it('says a move is in progress while it is in flight', async () => {
    stubApi({ ...activeGameRoutes, [SOLVE_ROUTE]: respondNever() });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    expect(screen.getByRole('status', { name: playCopy.moves.label })).toHaveTextContent(
      playCopy.moves.pending.solve,
    );
  });

  // Until the refetch lands, the board still offers the ad the move just solved.
  it('keeps moves locked and in progress until the board is refetched', async () => {
    const api = stubApi({
      ...activeGameRoutes,
      [TURN_ROUTE]: respondInSequence({
        responders: [respondOk({ body: TURN_VIEW }), respondNever()],
      }),
      [SOLVE_ROUTE]: respondOk({ body: MOVE_RESULT }),
    });

    renderInRouter(<GameScreen gameId="g1" />);
    await clickSolve();

    await waitFor(() => expect(api.callCountOf(TURN_ROUTE)).toBe(2));
    expect(screen.getByRole('button', { name: SOLVE_BUTTON })).toBeDisabled();
    expect(screen.getByRole('status', { name: playCopy.moves.label })).toHaveTextContent(
      playCopy.moves.pending.solve,
    );
  });
});
