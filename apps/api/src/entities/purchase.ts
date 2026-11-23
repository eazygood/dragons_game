import type { GameRunId } from './game-run.ts';

export interface Purchase {
  gameRunId: GameRunId;
  itemId: string;
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
