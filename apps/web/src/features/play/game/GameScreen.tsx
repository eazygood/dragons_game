import { useGame, useTurn } from '../../../api/game-queries.ts';
import { copy } from '../copy.ts';
import { errorCopy } from '../error-copy.ts';
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
    return <p role="alert">{errorCopy({ error: gameQuery.error })}</p>;
  }

  if (!isActive) {
    return <GameOverScreen game={gameQuery.data} />;
  }

  if (turnQuery.isPending) {
    return <p role="status">{copy.game.loadingTurn}</p>;
  }

  if (turnQuery.isError) {
    return <p role="alert">{errorCopy({ error: turnQuery.error })}</p>;
  }

  return <ActiveGame turn={turnQuery.data} />;
};
