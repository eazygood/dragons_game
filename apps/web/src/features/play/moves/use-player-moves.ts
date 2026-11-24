import type { MoveResult } from '@bigbank-dragon/contracts';

import { isApiError } from '../../../api/api-error.ts';
import { useBuyItem, useSolveAd } from '../../../api/game-mutations.ts';
import { isUpstreamDown } from '../error-copy.ts';
import type { MoveControls } from './move-controls.ts';

export type MoveNotice = 'ad_expired' | 'purchase_refused' | 'upstream_down' | 'unexpected';

type MoveKind = 'solve' | 'buy';

const noticeFor = ({ error, kind }: { error: unknown; kind: MoveKind }): MoveNotice | null => {
  // The settled invalidation refetches the game, which renders the end screen.
  if (isApiError({ error, code: 'game_over' })) {
    return null;
  }

  if (isApiError({ error, code: 'conflict' })) {
    return kind === 'solve' ? 'ad_expired' : 'purchase_refused';
  }

  return isUpstreamDown({ error }) ? 'upstream_down' : 'unexpected';
};

export const usePlayerMoves = ({
  gameId,
}: {
  gameId: string;
}): MoveControls & { lastMove: MoveResult | null; notice: MoveNotice | null } => {
  const solveMutation = useSolveAd({ gameId });
  const buyMutation = useBuyItem({ gameId });
  // Whichever move was submitted last is the one the player is waiting to hear about.
  const latestIsBuy = buyMutation.submittedAt > solveMutation.submittedAt;
  const latestMutation = latestIsBuy ? buyMutation : solveMutation;
  const latestKind: MoveKind = latestIsBuy ? 'buy' : 'solve';

  return {
    solve: (adId) => solveMutation.mutate({ adId }),
    buy: (itemId) => buyMutation.mutate({ itemId }),
    isPending: solveMutation.isPending || buyMutation.isPending,
    lastMove: latestMutation.data ?? null,
    notice: latestMutation.isError
      ? noticeFor({ error: latestMutation.error, kind: latestKind })
      : null,
  };
};
