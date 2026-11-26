import { AppError } from './app-error.ts';

export class TooManyRequestsError extends AppError {
  readonly retryAfterSeconds: number | undefined;

  constructor({
    message,
    retryAfterSeconds,
    cause,
  }: {
    message: string;
    retryAfterSeconds?: number;
    cause?: unknown;
  }) {
    super({ code: 'too_many_requests', message, statusCode: 429, cause });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
