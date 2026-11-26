import { useState } from 'react';

import { isApiError } from '../../api/api-error.ts';
import { useWatchedGame } from '../../api/game-queries.ts';
import { hasActiveStatus } from '../../api/game-status.ts';
import { ErrorNotice } from '../../shared/ErrorNotice.tsx';
import { GameStatusBar } from '../../shared/GameStatusBar.tsx';
import { GameUnavailable } from '../../shared/GameUnavailable.tsx';
import { focusOnMount } from '../../shared/focus-on-mount.ts';
import { sharedCopy } from '../../shared/shared-copy.ts';
import { MoveLog } from './MoveLog.tsx';
import { WatchOutcome } from './WatchOutcome.tsx';
import styles from './WatchScreen.module.css';
import { watchCopy } from './watch-copy.ts';

export const WatchScreen = ({ gameId }: { gameId: string }) => {
  const gameQuery = useWatchedGame({ gameId });
  const [isShowingMoves, setIsShowingMoves] = useState(false);

  if (gameQuery.isPending) {
    return <p role="status">{sharedCopy.game.loading}</p>;
  }

  if (isApiError({ error: gameQuery.error, code: 'not_found' })) {
    return <GameUnavailable reason="not_found" />;
  }

  // A failed refresh keeps the last good view and says so; the next poll replaces it.
  if (gameQuery.isLoadingError) {
    return (
      <ErrorNotice
        error={gameQuery.error}
        onRetry={() => void gameQuery.refetch()}
        isRetrying={gameQuery.isFetching}
      />
    );
  }

  return (
    <div className={styles.watch}>
      <h2 ref={focusOnMount} tabIndex={-1}>
        {watchCopy.title}
      </h2>
      <GameStatusBar state={gameQuery.data.state} hasRefreshFailed={gameQuery.isRefetchError} />
      <WatchOutcome game={gameQuery.data} />
      <label className={styles.moveToggle}>
        <input
          type="checkbox"
          checked={isShowingMoves}
          onChange={() => setIsShowingMoves((isShowing) => !isShowing)}
        />
        {watchCopy.showMoves}
      </label>
      {isShowingMoves && (
        <MoveLog gameId={gameId} isGameActive={hasActiveStatus({ game: gameQuery.data })} />
      )}
    </div>
  );
};
