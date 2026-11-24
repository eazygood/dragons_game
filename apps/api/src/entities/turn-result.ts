import type { GameState, RunStatus } from '@bigbank-dragon/contracts';

// `message` is the upstream's solve message; a purchase has none.
export type TurnResult = { state: GameState; success: boolean; message: string | null };

export type PlayerMove = TurnResult & { status: RunStatus };
