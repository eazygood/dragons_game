import { isApiError } from '../../../api/api-error.ts';
import { useGame, useTurnView } from '../../../api/game-queries.ts';
import { ErrorNotice } from '../../../shared/ErrorNotice.tsx';
import { GameUnavailable } from '../../../shared/GameUnavailable.tsx';
import { sharedCopy } from '../../../shared/shared-copy.ts';
import { playCopy } from '../play-copy.ts';
import { ActiveGame } from './ActiveGame.tsx';
import { GameOverScreen } from './GameOverScreen.tsx';

export const GameScreen = ({ gameId }: { gameId: string }) => {
  const gameQuery = useGame({ gameId });
  const isActive = gameQuery.data?.status === 'active';
  const turnQuery = useTurnView({ gameId, enabled: isActive });

  if (gameQuery.isPending) {
    return <p role="status">{sharedCopy.game.loading}</p>;
  }

  if (isApiError({ error: gameQuery.error, code: 'not_found' })) {
    return <GameUnavailable reason="not_found" />;
  }

  // A failed background refetch keeps the last good view on screen; only a first load fails hard.
  if (gameQuery.isLoadingError) {
    return <ErrorNotice error={gameQuery.error} onRetry={() => void gameQuery.refetch()} />;
  }

  if (!isActive) {
    return <GameOverScreen game={gameQuery.data} />;
  }

  // A 410 here already triggered a refetch of the game, which brings the end screen.
  if (turnQuery.isPending || isApiError({ error: turnQuery.error, code: 'game_over' })) {
    return <p role="status">{playCopy.game.loadingTurn}</p>;
  }

  // The only turn conflict is a game the bot is playing.
  if (isApiError({ error: turnQuery.error, code: 'conflict' })) {
    return <GameUnavailable reason="bot_game" gameId={gameId} />;
  }

  if (turnQuery.isLoadingError) {
    return <ErrorNotice error={turnQuery.error} onRetry={() => void turnQuery.refetch()} />;
  }

  return (
    <ActiveGame
      game={gameQuery.data}
      turnView={turnQuery.data}
      hasRefreshFailed={gameQuery.isRefetchError || turnQuery.isRefetchError}
    />
  );
};
