import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { gameKeys, useGame, useTurnView } from '../src/api/game-queries.ts';
import { respondOk, respondWith, stubApi } from './fetch-stub.ts';
import { GAME_ID, GAME_VIEW, buildGameView } from './fixtures.ts';
import { renderWithQuery } from './render.tsx';

const GAME_ROUTE_KEY = `GET /api/games/${GAME_ID}`;
const TURN_ROUTE_KEY = `GET /api/games/${GAME_ID}/turn`;

const GameProbe = () => {
  useGame({ gameId: GAME_ID });

  return null;
};

const TurnProbe = () => {
  useTurnView({ gameId: GAME_ID, enabled: true });

  return null;
};

const buildQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const isInvalidated = ({
  queryClient,
  queryKey,
}: {
  queryClient: QueryClient;
  queryKey: readonly unknown[];
}) => queryClient.getQueryState(queryKey)?.isInvalidated;

describe('useGame', () => {
  it('invalidates the move history once the game is no longer active', async () => {
    stubApi({
      [GAME_ROUTE_KEY]: respondOk({ body: buildGameView({ status: 'abandoned', score: 1240 }) }),
    });
    const queryClient = buildQueryClient();

    queryClient.setQueryData(gameKeys.moveHistory(GAME_ID), []);
    renderWithQuery(<GameProbe />, { queryClient });

    await waitFor(() =>
      expect(isInvalidated({ queryClient, queryKey: gameKeys.moveHistory(GAME_ID) })).toBe(true),
    );
  });

  it('leaves the move history alone while the game is active', async () => {
    stubApi({ [GAME_ROUTE_KEY]: respondOk({ body: GAME_VIEW }) });
    const queryClient = buildQueryClient();

    queryClient.setQueryData(gameKeys.moveHistory(GAME_ID), []);
    renderWithQuery(<GameProbe />, { queryClient });
    await waitFor(() =>
      expect(queryClient.getQueryData(gameKeys.game(GAME_ID))).toEqual(GAME_VIEW),
    );

    expect(isInvalidated({ queryClient, queryKey: gameKeys.moveHistory(GAME_ID) })).toBe(false);
  });
});

describe('useTurnView', () => {
  it('invalidates the stored game view when the turn answers 410, so the end screen can load', async () => {
    stubApi({
      [TURN_ROUTE_KEY]: respondWith({
        status: 410,
        body: { error: { code: 'game_over', message: 'Game over' } },
      }),
    });
    const queryClient = buildQueryClient();

    queryClient.setQueryData(gameKeys.game(GAME_ID), GAME_VIEW);
    renderWithQuery(<TurnProbe />, { queryClient });

    await waitFor(() =>
      expect(isInvalidated({ queryClient, queryKey: gameKeys.game(GAME_ID) })).toBe(true),
    );
    expect(queryClient.getQueryState(gameKeys.turn(GAME_ID))?.error).toMatchObject({
      code: 'game_over',
    });
  });

  it('keeps the stored game view when the turn fails for another reason', async () => {
    stubApi({
      [TURN_ROUTE_KEY]: respondWith({
        status: 502,
        body: { error: { code: 'upstream_unavailable', message: 'down' } },
      }),
    });
    const queryClient = buildQueryClient();

    queryClient.setQueryData(gameKeys.game(GAME_ID), GAME_VIEW);
    renderWithQuery(<TurnProbe />, { queryClient });
    await waitFor(() =>
      expect(queryClient.getQueryState(gameKeys.turn(GAME_ID))?.status).toBe('error'),
    );

    expect(isInvalidated({ queryClient, queryKey: gameKeys.game(GAME_ID) })).toBe(false);
  });
});
