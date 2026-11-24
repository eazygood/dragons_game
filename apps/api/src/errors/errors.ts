import type { TurnResult } from '../entities/turn-result.ts';
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

// Carries the turn the upstream already played, so a caller can keep playing
// the real game even though the local record of that turn was lost.
export class PersistenceFailedError extends AppError {
  readonly result: TurnResult;

  constructor({ message, cause, result }: ErrorDetail & { result: TurnResult }) {
    super({ code: 'internal', message, statusCode: 500, cause });
    this.result = result;
  }
}

// Checked before the upstream call: a refused purchase there still burns a turn.
export class InsufficientGoldError extends AppError {
  constructor({ message, cause }: ErrorDetail) {
    super({ code: 'conflict', message, statusCode: 409, cause });
  }
}

export class ShopItemNotFoundError extends AppError {
  constructor({ message, cause }: ErrorDetail) {
    super({ code: 'not_found', message, statusCode: 404, cause });
  }
}

// A bot's run belongs to the bot; a human move would desync it.
export class GameNotPlayableError extends AppError {
  constructor({ message, cause }: ErrorDetail) {
    super({ code: 'conflict', message, statusCode: 409, cause });
  }
}
