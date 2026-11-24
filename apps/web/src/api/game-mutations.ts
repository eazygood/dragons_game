import { GameViewSchema, MoveResultSchema } from '@bigbank-dragon/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client.ts';
import { gamePaths } from './game-paths.ts';
import { gameKeys } from './game-queries.ts';

export const useStartGame = () =>
  useMutation({
    mutationFn: () =>
      apiRequest({ path: gamePaths.games(), method: 'POST', schema: GameViewSchema }),
  });

export const useStartBotGame = () =>
  useMutation({
    mutationFn: () =>
      apiRequest({ path: gamePaths.botGames(), method: 'POST', schema: GameViewSchema }),
  });

// Settled, not success: a failed move can still have burnt a turn and aged every ad.
const useMove = <T>({
  gameId,
  buildPath,
}: {
  gameId: string;
  buildPath: (variables: T) => string;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: T) =>
      apiRequest({ path: buildPath(variables), method: 'POST', schema: MoveResultSchema }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.all(gameId) }),
  });
};

export const useSolveAd = ({ gameId }: { gameId: string }) =>
  useMove({ gameId, buildPath: ({ adId }: { adId: string }) => gamePaths.solve({ gameId, adId }) });

export const useBuyItem = ({ gameId }: { gameId: string }) =>
  useMove({
    gameId,
    buildPath: ({ itemId }: { itemId: string }) => gamePaths.buy({ gameId, itemId }),
  });
