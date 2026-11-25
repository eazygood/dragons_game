import { GameViewSchema, MoveListSchema, TurnViewSchema } from '@bigbank-dragon/contracts';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { isApiError } from './api-error.ts';
import { apiRequest } from './client.ts';
import { gamePaths } from './game-paths.ts';

export const WATCH_POLL_INTERVAL_MS = 1000;

export const gameKeys = {
  all: (gameId: string) => ['game', gameId] as const,
  game: (gameId: string) => ['game', gameId, 'view'] as const,
  turn: (gameId: string) => ['game', gameId, 'turn'] as const,
  moveHistory: (gameId: string) => ['game', gameId, 'moves'] as const,
};

const gameQueryOptions = ({ gameId }: { gameId: string }) =>
  queryOptions({
    queryKey: gameKeys.game(gameId),
    queryFn: async ({ client, signal }) => {
      const game = await apiRequest({
        path: gamePaths.game({ gameId }),
        schema: GameViewSchema,
        signal,
      });

      // The game and history polls run on independent timers, so a finished game needs one
      // last history fetch to show the moves made since the previous tick.
      if (game.status !== 'active') {
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
      query.state.data?.status === 'active' ? WATCH_POLL_INTERVAL_MS : false,
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
  enabled,
  isGameActive,
}: {
  gameId: string;
  enabled: boolean;
  isGameActive: boolean;
}) =>
  useQuery({
    queryKey: gameKeys.moveHistory(gameId),
    queryFn: ({ signal }) =>
      apiRequest({ path: gamePaths.moveHistory({ gameId }), schema: MoveListSchema, signal }),
    enabled,
    refetchInterval: isGameActive ? WATCH_POLL_INTERVAL_MS : false,
  });
