import type { GameState, RunStatus } from '@bigbank-dragon/contracts';

// `message` is the upstream's solve message; a purchase has none.
export type TurnResult = { state: GameState; success: boolean; message: string | null };

export type PlayerMove = TurnResult & { status: RunStatus };

// `persisted` is false when the turn's record could not be written: the upstream turn
// still happened, so the caller decides what a lost record means for it.
export type SavedTurn = { turn: TurnResult; persisted: boolean };
