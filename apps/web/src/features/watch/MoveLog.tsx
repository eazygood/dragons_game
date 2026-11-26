import { useMoveHistory } from '../../api/game-queries.ts';
import { ErrorNotice } from '../../shared/ErrorNotice.tsx';
import { RefreshHint } from '../../shared/RefreshHint.tsx';
import { MoveLine } from './MoveLine.tsx';
import styles from './MoveLog.module.css';
import { keyedMoves } from './keyed-moves.ts';
import { watchCopy } from './watch-copy.ts';

type MoveLogProps = {
  gameId: string;
  isGameActive: boolean;
};

// The API lists newest first, so the log is rendered in the order it arrives.
export const MoveLog = ({ gameId, isGameActive }: MoveLogProps) => {
  const moveHistoryQuery = useMoveHistory({ gameId, isGameActive });

  if (moveHistoryQuery.isPending) {
    return <p role="status">{watchCopy.loadingMoves}</p>;
  }

  // A failed refresh keeps the last good list; the next poll replaces it.
  if (moveHistoryQuery.isLoadingError) {
    return (
      <ErrorNotice
        error={moveHistoryQuery.error}
        onRetry={() => void moveHistoryQuery.refetch()}
        isRetrying={moveHistoryQuery.isFetching}
      />
    );
  }

  return (
    <div>
      <RefreshHint hasFailed={moveHistoryQuery.isRefetchError} />
      {moveHistoryQuery.data.length === 0 ? (
        <p>{watchCopy.noMovesYet}</p>
      ) : (
        <ol className={styles.log} aria-label={watchCopy.moveListLabel}>
          {keyedMoves({ moves: moveHistoryQuery.data }).map(({ move, key }) => (
            <MoveLine key={key} move={move} />
          ))}
        </ol>
      )}
    </div>
  );
};
