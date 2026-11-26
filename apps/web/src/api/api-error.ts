import type { ApiErrorCode } from '@dragons-game/contracts';

export type ClientErrorCode = ApiErrorCode | 'unreachable' | 'invalid_response';

export const UNREACHABLE_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;

  constructor({
    status,
    code,
    message,
  }: {
    status: number;
    code: ClientErrorCode;
    message: string;
  }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const isApiError = ({ error, code }: { error: unknown; code: ClientErrorCode }) =>
  error instanceof ApiError && error.code === code;
