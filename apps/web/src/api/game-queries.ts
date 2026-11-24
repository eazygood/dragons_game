import { GameViewSchema, TurnViewSchema } from '@bigbank-dragon/contracts';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client.ts';
import { gamePaths } from './game-paths.ts';

export const GAME_KEY_ROOT = 'game';
export const TURN_KEY_SUFFIX = 'turn';

export const gameKeys = {
  all: (gameId: string) => [GAME_KEY_ROOT, gameId] as const,
  game: (gameId: string) => [GAME_KEY_ROOT, gameId, 'view'] as const,
  turn: (gameId: string) => [GAME_KEY_ROOT, gameId, TURN_KEY_SUFFIX] as const,
};

export const useGame = ({ gameId }: { gameId: string }) =>
  useQuery({
    queryKey: gameKeys.game(gameId),
    queryFn: () => apiRequest({ path: gamePaths.game({ gameId }), schema: GameViewSchema }),
  });

export const useTurn = ({ gameId, enabled }: { gameId: string; enabled: boolean }) =>
  useQuery({
    queryKey: gameKeys.turn(gameId),
    queryFn: () => apiRequest({ path: gamePaths.turn({ gameId }), schema: TurnViewSchema }),
    enabled,
  });
