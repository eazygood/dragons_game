import type { MoveResult } from '@dragons-game/contracts';
import type { RefObject } from 'react';

import type { MoveRequest } from '../../../api/game-mutations.ts';

export type MoveActions = {
  solve: (adId: string) => void;
  buy: (itemId: string) => void;
  isPending: boolean;
};

export type MoveReport = {
  pendingKind: MoveRequest['kind'] | null;
  lastResult: MoveResult | null;
  notice: string | null;
};

export type FeedbackRef = RefObject<HTMLParagraphElement | null>;
