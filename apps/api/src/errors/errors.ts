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
