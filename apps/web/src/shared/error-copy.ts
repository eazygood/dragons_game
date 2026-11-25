import { ApiError } from '../api/api-error.ts';
import type { ClientErrorCode } from '../api/api-error.ts';
import { sharedCopy } from './shared-copy.ts';

// Exhaustive on purpose: a new error code fails typecheck until someone decides what to tell the user.
export const ERROR_COPY = {
  invalid_request: sharedCopy.errors.unexpected,
  not_found: sharedCopy.errors.unexpected,
  conflict: sharedCopy.errors.unexpected,
  upstream_unavailable: sharedCopy.errors.upstreamUnavailable,
  internal: sharedCopy.errors.unexpected,
  game_over: sharedCopy.errors.unexpected,
  too_many_requests: sharedCopy.errors.tooManyRequests,
  unreachable: sharedCopy.errors.unreachable,
  invalid_response: sharedCopy.errors.unexpected,
} satisfies Record<ClientErrorCode, string>;

export const errorCopy = ({ error }: { error: unknown }) =>
  error instanceof ApiError ? ERROR_COPY[error.code] : sharedCopy.errors.unexpected;
