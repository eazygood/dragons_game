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

// A player's next move rebuilds state from the row, so a turn whose state could not be
// saved is reported rather than claimed as played.
export class PersistenceFailedError extends AppError {
  constructor({ message, cause }: ErrorDetail) {
    super({ code: 'internal', message, statusCode: 500, cause });
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
