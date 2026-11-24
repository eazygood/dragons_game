import type { Move } from '@bigbank-dragon/contracts';
import type { UseQueryResult } from '@tanstack/react-query';

import { ErrorNotice } from '../play/moves/ErrorNotice.tsx';
import { MoveLine } from './MoveLine.tsx';
import styles from './MoveLog.module.css';
import { watchCopy } from './watch-copy.ts';

// The API lists newest first, so the log is rendered in the order it arrives.
export const MoveLog = ({ movesQuery }: { movesQuery: UseQueryResult<Move[]> }) => {
  if (movesQuery.isPending) {
    return <p role="status">{watchCopy.loadingMoves}</p>;
  }

  // A failed refresh keeps the last good list; the next poll replaces it.
  if (movesQuery.isError && movesQuery.data === undefined) {
    return <ErrorNotice error={movesQuery.error} onRetry={() => void movesQuery.refetch()} />;
  }

  if (movesQuery.data.length === 0) {
    return <p>{watchCopy.noMovesYet}</p>;
  }

  return (
    <ol className={styles.log} aria-label={watchCopy.moveListLabel}>
      {movesQuery.data.map((move) => (
        <MoveLine key={`${move.kind}-${move.turn}`} move={move} />
      ))}
    </ol>
  );
};
