import { isApiError } from '../../../api/api-error.ts';
import { useGame, useTurn } from '../../../api/game-queries.ts';
import { copy } from '../copy.ts';
import { ErrorNotice } from '../moves/ErrorNotice.tsx';
import { ActiveGame } from './ActiveGame.tsx';
import { GameOverScreen } from './GameOverScreen.tsx';
import { GameUnavailable } from './GameUnavailable.tsx';

export const GameScreen = ({ gameId }: { gameId: string }) => {
  const gameQuery = useGame({ gameId });
  const isActive = gameQuery.data?.status === 'active';
  const turnQuery = useTurn({ gameId, enabled: isActive });

  if (gameQuery.isPending) {
    return <p role="status">{copy.game.loading}</p>;
  }

  if (isApiError({ error: gameQuery.error, code: 'not_found' })) {
    return <GameUnavailable reason="not_found" />;
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

  // The only turn conflict is a game the bot is playing.
  if (isApiError({ error: turnQuery.error, code: 'conflict' })) {
    return <GameUnavailable reason="bot_game" gameId={gameId} />;
  }

  if (turnQuery.isError) {
    return <ErrorNotice error={turnQuery.error} onRetry={() => void turnQuery.refetch()} />;
  }

  return <ActiveGame turn={turnQuery.data} />;
};
