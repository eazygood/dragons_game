import { useState } from 'react';

import { isApiError } from '../../api/api-error.ts';
import { useMoves, useWatchedGame } from '../../api/game-queries.ts';
import { copy } from '../play/copy.ts';
import { GameStatusBar } from '../play/game/GameStatusBar.tsx';
import { GameUnavailable } from '../play/game/GameUnavailable.tsx';
import { ErrorNotice } from '../play/moves/ErrorNotice.tsx';
import { MoveLog } from './MoveLog.tsx';
import { WatchOutcome } from './WatchOutcome.tsx';
import styles from './WatchScreen.module.css';
import { watchCopy } from './watch-copy.ts';

export const WatchScreen = ({ gameId }: { gameId: string }) => {
  const gameQuery = useWatchedGame({ gameId });
  const [isShowingMoves, setIsShowingMoves] = useState(false);
  const movesQuery = useMoves({
    gameId,
    enabled: isShowingMoves,
    isGameActive: gameQuery.data?.status === 'active',
  });

  if (gameQuery.isPending) {
    return <p role="status">{copy.game.loading}</p>;
  }

  if (isApiError({ error: gameQuery.error, code: 'not_found' })) {
    return <GameUnavailable reason="not_found" />;
  }

  // A failed refresh keeps the last good view; the next poll replaces it.
  if (gameQuery.isError && gameQuery.data === undefined) {
    return <ErrorNotice error={gameQuery.error} onRetry={() => void gameQuery.refetch()} />;
  }

  return (
    <div className={styles.watch}>
      <h2>{watchCopy.title}</h2>
      <GameStatusBar state={gameQuery.data.state} />
      <WatchOutcome game={gameQuery.data} />
      <label className={styles.moveToggle}>
        <input
          type="checkbox"
          checked={isShowingMoves}
          onChange={() => setIsShowingMoves((isShowing) => !isShowing)}
        />
        {watchCopy.showMoves}
      </label>
      {isShowingMoves && <MoveLog movesQuery={movesQuery} />}
    </div>
  );
};
