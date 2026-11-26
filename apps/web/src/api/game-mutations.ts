import { GameViewSchema, MoveResultSchema } from '@dragons-game/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client.ts';
import { gamePaths } from './game-paths.ts';
import { gameKeys } from './game-queries.ts';

// Seeding the view lets the next screen render the new game instead of flashing "Loading game…".
const useStartMutation = ({ path }: { path: string }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiRequest({ path, method: 'POST', schema: GameViewSchema }),
    onSuccess: (game) => queryClient.setQueryData(gameKeys.game(game.state.gameId), game),
  });
};

export const useStartGame = () => useStartMutation({ path: gamePaths.games() });

export const useStartBotGame = () => useStartMutation({ path: gamePaths.botGames() });

export type MoveRequest = { kind: 'solve'; adId: string } | { kind: 'buy'; itemId: string };

const moveRequestPath = ({ gameId, request }: { gameId: string; request: MoveRequest }) =>
  request.kind === 'solve'
    ? gamePaths.solve({ gameId, adId: request.adId })
    : gamePaths.buy({ gameId, itemId: request.itemId });

export const useSubmitMove = ({ gameId }: { gameId: string }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: MoveRequest) =>
      apiRequest({
        path: moveRequestPath({ gameId, request }),
        method: 'POST',
        schema: MoveResultSchema,
      }),
    // The result already carries the new game state, so the status bar need not wait for a refetch.
    onSuccess: (result) => queryClient.setQueryData(gameKeys.game(gameId), result.game),
    // Settled, not success: a failed move can still have burnt a turn and aged every ad.
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.all(gameId) }),
  });
};
