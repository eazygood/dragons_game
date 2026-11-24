import type { DecisionRule } from '@bigbank-dragon/contracts';

import type { GameRunId } from './game-run.ts';

export interface Purchase {
  gameRunId: GameRunId;
  itemId: string;
  // Both null on rows written before the rule and name were recorded.
  itemName: string | null;
  rule: DecisionRule | null;
  cost: number;
  turn: number;
  success: boolean;
  createdAt: Date;
}

// What a buy reports back; level only counts when the purchase succeeded.
export interface BuyOutcome {
  success: boolean;
  lives: number;
  gold: number;
  level: number;
  turn: number;
}
