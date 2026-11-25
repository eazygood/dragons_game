import { GameViewSchema, MoveListSchema, TurnViewSchema } from '@bigbank-dragon/contracts';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client.ts';
import { gamePaths } from './game-paths.ts';

export const GAME_KEY_ROOT = 'game';
export const VIEW_KEY_SUFFIX = 'view';
export const TURN_KEY_SUFFIX = 'turn';
export const MOVES_KEY_SUFFIX = 'moves';
export const WATCH_POLL_INTERVAL_MS = 1000;

export const gameKeys = {
  all: (gameId: string) => [GAME_KEY_ROOT, gameId] as const,
  game: (gameId: string) => [GAME_KEY_ROOT, gameId, VIEW_KEY_SUFFIX] as const,
  turn: (gameId: string) => [GAME_KEY_ROOT, gameId, TURN_KEY_SUFFIX] as const,
  moves: (gameId: string) => [GAME_KEY_ROOT, gameId, MOVES_KEY_SUFFIX] as const,
};

const gameQueryOptions = ({ gameId }: { gameId: string }) => ({
  queryKey: gameKeys.game(gameId),
  queryFn: () => apiRequest({ path: gamePaths.game({ gameId }), schema: GameViewSchema }),
});

export const useGame = ({ gameId }: { gameId: string }) => useQuery(gameQueryOptions({ gameId }));

// Shares the key with useGame, so a bot game is polled until it leaves `active`, then left alone.
export const useWatchedGame = ({ gameId }: { gameId: string }) =>
  useQuery({
    ...gameQueryOptions({ gameId }),
    refetchInterval: (query) =>
      query.state.data?.status === 'active' ? WATCH_POLL_INTERVAL_MS : false,
  });

export const useTurn = ({ gameId, enabled }: { gameId: string; enabled: boolean }) =>
  useQuery({
    queryKey: gameKeys.turn(gameId),
    queryFn: () => apiRequest({ path: gamePaths.turn({ gameId }), schema: TurnViewSchema }),
    enabled,
  });

export const useMoves = ({
  gameId,
  enabled,
  isGameActive,
}: {
  gameId: string;
  enabled: boolean;
  isGameActive: boolean;
}) =>
  useQuery({
    queryKey: gameKeys.moves(gameId),
    queryFn: () => apiRequest({ path: gamePaths.moves({ gameId }), schema: MoveListSchema }),
    enabled,
    refetchInterval: isGameActive ? WATCH_POLL_INTERVAL_MS : false,
  });
