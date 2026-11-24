import { QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError, isApiError } from './api/api-error.ts';
import { GAME_KEY_ROOT, TURN_KEY_SUFFIX, gameKeys } from './api/game-queries.ts';

const MAX_READ_RETRIES = 2;
const FIRST_SERVER_ERROR_STATUS = 500;

const isTransient = (error: unknown) =>
  isApiError({ error, code: 'unreachable' }) ||
  (error instanceof ApiError && error.status >= FIRST_SERVER_ERROR_STATUS);

export const shouldRetryRead = ({
  failureCount,
  error,
}: {
  failureCount: number;
  error: unknown;
}) => failureCount < MAX_READ_RETRIES && isTransient(error);

const gameIdOfTurnQuery = (queryKey: readonly unknown[]) => {
  const [root, gameId, suffix] = queryKey;

  if (root !== GAME_KEY_ROOT || suffix !== TURN_KEY_SUFFIX || typeof gameId !== 'string') {
    return null;
  }

  return gameId;
};

export const createQueryClient = () => {
  const queryClient: QueryClient = new QueryClient({
    // A 410 on the board means the stored game view is stale; refetch it to show the end screen.
    queryCache: new QueryCache({
      onError: (error, query) => {
        const gameId = gameIdOfTurnQuery(query.queryKey);

        if (gameId === null || !isApiError({ error, code: 'game_over' })) {
          return;
        }

        void queryClient.invalidateQueries({ queryKey: gameKeys.game(gameId) });
      },
    }),
    defaultOptions: {
      queries: { retry: (failureCount, error) => shouldRetryRead({ failureCount, error }) },
      mutations: { retry: false },
    },
  });

  return queryClient;
};
