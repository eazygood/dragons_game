import type { GameView } from '@bigbank-dragon/contracts';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../src/api/api-error.ts';
import { gameKeys } from '../src/api/game-queries.ts';
import { createQueryClient, shouldRetryRead } from '../src/query-client.ts';
import { ABOVE_TARGET, GAME_ID, SOLVE_MOVE, buildGameView } from './fixtures.ts';

const OTHER_GAME_ID = 'g2';

const networkDown = new ApiError({ status: 0, code: 'unreachable', message: 'offline' });
const upstreamDown = new ApiError({ status: 502, code: 'upstream_unavailable', message: 'down' });
const adExpired = new ApiError({ status: 409, code: 'conflict', message: 'gone' });

const fetchGameViewWithStoredMoves = async ({ status }: { status: GameView['status'] }) => {
  const queryClient = createQueryClient();

  queryClient.setQueryData(gameKeys.moves(GAME_ID), [SOLVE_MOVE]);
  queryClient.setQueryData(gameKeys.moves(OTHER_GAME_ID), [SOLVE_MOVE]);
  await queryClient.fetchQuery({
    queryKey: gameKeys.game(GAME_ID),
    queryFn: () => buildGameView({ status, score: ABOVE_TARGET }),
  });

  return {
    gameMoves: queryClient.getQueryState(gameKeys.moves(GAME_ID)),
    otherGameMoves: queryClient.getQueryState(gameKeys.moves(OTHER_GAME_ID)),
  };
};

describe('shouldRetryRead', () => {
  it('retries a dropped connection and a 5xx', () => {
    expect(shouldRetryRead({ failureCount: 0, error: networkDown })).toBe(true);
    expect(shouldRetryRead({ failureCount: 1, error: upstreamDown })).toBe(true);
  });

  it('stops after two retries', () => {
    expect(shouldRetryRead({ failureCount: 2, error: upstreamDown })).toBe(false);
  });

  it('never retries a 4xx answer', () => {
    expect(shouldRetryRead({ failureCount: 0, error: adExpired })).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('never retries a mutation, because solve and buy are not idempotent', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it.each(['abandoned', 'game_over'] as const)(
    "refreshes only that game's moves once its view reports %s",
    async (status) => {
      const { gameMoves, otherGameMoves } = await fetchGameViewWithStoredMoves({ status });

      expect(gameMoves?.isInvalidated).toBe(true);
      expect(otherGameMoves?.isInvalidated).toBe(false);
    },
  );

  it('leaves the moves alone while the game view is still active', async () => {
    const { gameMoves } = await fetchGameViewWithStoredMoves({ status: 'active' });

    expect(gameMoves?.isInvalidated).toBe(false);
  });
});
