import { useState } from 'react';

import { isApiError } from '../../api/api-error.ts';
import { useMoveHistory, useWatchedGame } from '../../api/game-queries.ts';
import { ErrorNotice } from '../../shared/ErrorNotice.tsx';
import { GameStatusBar } from '../../shared/GameStatusBar.tsx';
import { GameUnavailable } from '../../shared/GameUnavailable.tsx';
import { sharedCopy } from '../../shared/shared-copy.ts';
import { MoveLog } from './MoveLog.tsx';
import { WatchOutcome } from './WatchOutcome.tsx';
import styles from './WatchScreen.module.css';
import { watchCopy } from './watch-copy.ts';

export const WatchScreen = ({ gameId }: { gameId: string }) => {
  const gameQuery = useWatchedGame({ gameId });
  const [isShowingMoves, setIsShowingMoves] = useState(false);
  const moveHistoryQuery = useMoveHistory({
    gameId,
    enabled: isShowingMoves,
    isGameActive: gameQuery.data?.status === 'active',
  });

  if (gameQuery.isPending) {
    return <p role="status">{sharedCopy.game.loading}</p>;
  }

  if (isApiError({ error: gameQuery.error, code: 'not_found' })) {
    return <GameUnavailable reason="not_found" />;
  }

  // A failed refresh keeps the last good view; the next poll replaces it.
  if (gameQuery.isLoadingError) {
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
      {isShowingMoves && <MoveLog moveHistoryQuery={moveHistoryQuery} />}
    </div>
  );
};
