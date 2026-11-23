import type { GameState } from '@bigbank-dragon/contracts';

import { AppError } from './app-error.ts';

type ErrorDetail = { message: string; cause?: unknown };

export class UpstreamUnavailableError extends AppError {
  constructor({ message, cause }: ErrorDetail) {
    super({ code: 'upstream_unavailable', message, statusCode: 502, cause });
  }
}

export class GameNotFoundError extends AppError {
  constructor({ message, cause }: ErrorDetail) {
    super({ code: 'not_found', message, statusCode: 404, cause });
  }
}

export class AdExpiredError extends AppError {
  constructor({ message, cause }: ErrorDetail) {
    super({ code: 'conflict', message, statusCode: 409, cause });
  }
}

// Carries the state the upstream already moved to, so a caller can keep playing
// the real game even though the local record of that turn was lost.
export class PersistenceFailedError extends AppError {
  readonly state: GameState;

  constructor({ message, cause, state }: ErrorDetail & { state: GameState }) {
    super({ code: 'internal', message, statusCode: 500, cause });
    this.state = state;
  }
}
