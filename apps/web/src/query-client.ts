import { GameViewSchema } from '@bigbank-dragon/contracts';
import { QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError, isApiError } from './api/api-error.ts';
import { GAME_KEY_ROOT, TURN_KEY_SUFFIX, VIEW_KEY_SUFFIX, gameKeys } from './api/game-queries.ts';

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

const gameIdOfQuery = ({ queryKey, suffix }: { queryKey: readonly unknown[]; suffix: string }) => {
  const [root, gameId, keySuffix] = queryKey;

  if (root !== GAME_KEY_ROOT || keySuffix !== suffix || typeof gameId !== 'string') {
    return null;
  }

  return gameId;
};

export const createQueryClient = () => {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      // A 410 on the board means the stored game view is stale; refetch it to show the end screen.
      onError: (error, query) => {
        const gameId = gameIdOfQuery({ queryKey: query.queryKey, suffix: TURN_KEY_SUFFIX });

        if (gameId === null || !isApiError({ error, code: 'game_over' })) {
          return;
        }

        void queryClient.invalidateQueries({ queryKey: gameKeys.game(gameId) });
      },
      // The game and moves polls run on independent timers, so a finished game needs one last
      // moves fetch to show the moves made since the previous tick.
      onSuccess: (data, query) => {
        const gameId = gameIdOfQuery({ queryKey: query.queryKey, suffix: VIEW_KEY_SUFFIX });
        const gameView = GameViewSchema.safeParse(data);

        if (gameId === null || !gameView.success || gameView.data.status === 'active') {
          return;
        }

        void queryClient.invalidateQueries({ queryKey: gameKeys.moves(gameId) });
      },
    }),
    defaultOptions: {
      queries: { retry: (failureCount, error) => shouldRetryRead({ failureCount, error }) },
      mutations: { retry: false },
    },
  });

  return queryClient;
};
