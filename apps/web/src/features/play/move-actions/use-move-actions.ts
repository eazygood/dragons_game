import { useRef } from 'react';

import { isApiError } from '../../../api/api-error.ts';
import { useSubmitMove } from '../../../api/game-mutations.ts';
import type { MoveRequest } from '../../../api/game-mutations.ts';
import { errorCopy } from '../../../shared/error-copy.ts';
import { playCopy } from '../play-copy.ts';
import type { FeedbackRef, MoveActions, MoveOutcome } from './move-actions.ts';

const noticeFor = ({ error, kind }: { error: unknown; kind: MoveRequest['kind'] }) => {
  // The settled invalidation refetches the game, which renders the end screen.
  if (isApiError({ error, code: 'game_over' })) {
    return null;
  }

  if (isApiError({ error, code: 'conflict' })) {
    return kind === 'solve' ? playCopy.moves.adExpired : playCopy.moves.purchaseRefused;
  }

  return errorCopy({ error });
};

export const useMoveActions = ({
  gameId,
}: {
  gameId: string;
}): { moveActions: MoveActions; moveOutcome: MoveOutcome; feedbackRef: FeedbackRef } => {
  const submitMove = useSubmitMove({ gameId });
  const feedbackRef: FeedbackRef = useRef(null);

  // The clicked card is disabled, then replaced, which would drop focus to <body>.
  // The feedback region outlives the board and is where the result is announced.
  const submit = (request: MoveRequest) => {
    submitMove.mutate(request);
    feedbackRef.current?.focus();
  };

  return {
    moveActions: {
      solve: (adId) => submit({ kind: 'solve', adId }),
      buy: (itemId) => submit({ kind: 'buy', itemId }),
      isPending: submitMove.isPending,
    },
    moveOutcome: {
      lastResult: submitMove.data ?? null,
      notice: submitMove.isError
        ? noticeFor({ error: submitMove.error, kind: submitMove.variables.kind })
        : null,
    },
    feedbackRef,
  };
};
