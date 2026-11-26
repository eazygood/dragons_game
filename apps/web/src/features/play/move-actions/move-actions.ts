import type { MoveResult } from '@dragons-game/contracts';
import type { RefObject } from 'react';

export type MoveActions = {
  solve: (adId: string) => void;
  buy: (itemId: string) => void;
  isPending: boolean;
};

export type MoveReport = {
  lastResult: MoveResult | null;
  notice: string | null;
};

export type FeedbackRef = RefObject<HTMLParagraphElement | null>;
