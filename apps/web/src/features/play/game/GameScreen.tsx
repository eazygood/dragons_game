import { isApiError } from '../../../api/api-error.ts';
import { useGame, useTurn } from '../../../api/game-queries.ts';
import { copy } from '../copy.ts';
import { ErrorNotice } from '../moves/ErrorNotice.tsx';
import { ActiveGame } from './ActiveGame.tsx';
import { GameOverScreen } from './GameOverScreen.tsx';

export const GameScreen = ({ gameId }: { gameId: string }) => {
  const gameQuery = useGame({ gameId });
  const isActive = gameQuery.data?.status === 'active';
  const turnQuery = useTurn({ gameId, enabled: isActive });

  if (gameQuery.isPending) {
    return <p role="status">{copy.game.loading}</p>;
  }

  if (gameQuery.isError) {
    return <ErrorNotice error={gameQuery.error} onRetry={() => void gameQuery.refetch()} />;
  }

  if (!isActive) {
    return <GameOverScreen game={gameQuery.data} />;
  }

  // A 410 here already triggered a refetch of the game, which brings the end screen.
  if (turnQuery.isPending || isApiError({ error: turnQuery.error, code: 'game_over' })) {
    return <p role="status">{copy.game.loadingTurn}</p>;
  }

  if (turnQuery.isError) {
    return <ErrorNotice error={turnQuery.error} onRetry={() => void turnQuery.refetch()} />;
  }

  return <ActiveGame turn={turnQuery.data} />;
};
