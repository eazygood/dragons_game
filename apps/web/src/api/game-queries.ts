import { GameViewSchema, MoveListSchema, TurnViewSchema } from '@bigbank-dragon/contracts';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { isApiError } from './api-error.ts';
import { apiRequest } from './client.ts';
import { gamePaths } from './game-paths.ts';
import { hasActiveStatus } from './game-status.ts';
import { MOVE_HISTORY_POLL_INTERVAL_MS, WATCH_POLL_INTERVAL_MS } from './poll-intervals.ts';

// Long enough that a view seeded by setQueryData is not refetched the moment its screen
// mounts. Polling and invalidation ignore it, so /watch and post-move refreshes are unaffected.
const GAME_VIEW_STALE_TIME_MS = 5000;

export const gameKeys = {
  all: (gameId: string) => ['game', gameId] as const,
  game: (gameId: string) => ['game', gameId, 'view'] as const,
  turn: (gameId: string) => ['game', gameId, 'turn'] as const,
  moveHistory: (gameId: string) => ['game', gameId, 'moves'] as const,
};

const gameQueryOptions = ({ gameId }: { gameId: string }) =>
  queryOptions({
    queryKey: gameKeys.game(gameId),
    staleTime: GAME_VIEW_STALE_TIME_MS,
    queryFn: async ({ client, signal }) => {
      const game = await apiRequest({
        path: gamePaths.game({ gameId }),
        schema: GameViewSchema,
        signal,
      });

      // The game and history polls run on independent timers, so a finished game needs one
      // last history fetch to show the moves made since the previous tick.
      if (!hasActiveStatus({ game })) {
        void client.invalidateQueries({ queryKey: gameKeys.moveHistory(gameId) });
      }

      return game;
    },
  });

export const useGame = ({ gameId }: { gameId: string }) => useQuery(gameQueryOptions({ gameId }));

// Shares the key with useGame, so a bot game is polled until it leaves `active`, then left alone.
export const useWatchedGame = ({ gameId }: { gameId: string }) =>
  useQuery({
    ...gameQueryOptions({ gameId }),
    refetchInterval: (query) =>
      hasActiveStatus({ game: query.state.data }) ? WATCH_POLL_INTERVAL_MS : false,
  });

export const useTurnView = ({ gameId, enabled }: { gameId: string; enabled: boolean }) =>
  useQuery({
    queryKey: gameKeys.turn(gameId),
    queryFn: async ({ client, signal }) => {
      try {
        return await apiRequest({
          path: gamePaths.turn({ gameId }),
          schema: TurnViewSchema,
          signal,
        });
      } catch (error) {
        // A 410 means the stored game view is stale; refetching it brings the end screen.
        if (isApiError({ error, code: 'game_over' })) {
          void client.invalidateQueries({ queryKey: gameKeys.game(gameId) });
        }

        throw error;
      }
    },
    enabled,
  });

export const useMoveHistory = ({
  gameId,
  isGameActive,
}: {
  gameId: string;
  isGameActive: boolean;
}) =>
  useQuery({
    queryKey: gameKeys.moveHistory(gameId),
    queryFn: ({ signal }) =>
      apiRequest({ path: gamePaths.moveHistory({ gameId }), schema: MoveListSchema, signal }),
    refetchInterval: isGameActive ? MOVE_HISTORY_POLL_INTERVAL_MS : false,
  });
