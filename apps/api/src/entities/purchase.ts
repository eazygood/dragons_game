import type { GameRunId } from './game-run.ts';

export interface Purchase {
  gameRunId: GameRunId;
  itemId: string;
  cost: number;
  turn: number;
  success: boolean;
  createdAt: Date;
}
