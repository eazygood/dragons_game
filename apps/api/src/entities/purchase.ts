import type { DecisionRule } from '@dragons-game/contracts';

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
