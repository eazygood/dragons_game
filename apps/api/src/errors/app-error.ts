import type { ApiErrorCode } from '@dragons-game/contracts';

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;

  constructor({
    code,
    message,
    statusCode,
    cause,
  }: {
    code: ApiErrorCode;
    message: string;
    statusCode: number;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}
