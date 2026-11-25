import type { Move } from '@bigbank-dragon/contracts';
import type { UseQueryResult } from '@tanstack/react-query';

import { ErrorNotice } from '../../shared/ErrorNotice.tsx';
import { MoveLine } from './MoveLine.tsx';
import styles from './MoveLog.module.css';
import { watchCopy } from './watch-copy.ts';

// The API lists newest first, so the log is rendered in the order it arrives.
export const MoveLog = ({ moveHistoryQuery }: { moveHistoryQuery: UseQueryResult<Move[]> }) => {
  if (moveHistoryQuery.isPending) {
    return <p role="status">{watchCopy.loadingMoves}</p>;
  }

  // A failed refresh keeps the last good list; the next poll replaces it.
  if (moveHistoryQuery.isLoadingError) {
    return (
      <ErrorNotice error={moveHistoryQuery.error} onRetry={() => void moveHistoryQuery.refetch()} />
    );
  }

  if (moveHistoryQuery.data.length === 0) {
    return <p>{watchCopy.noMovesYet}</p>;
  }

  return (
    <ol className={styles.log} aria-label={watchCopy.moveListLabel}>
      {moveHistoryQuery.data.map((move) => (
        <MoveLine key={`${move.kind}-${move.turn}`} move={move} />
      ))}
    </ol>
  );
};
