import { describe, expect, it } from 'vitest';

import { ApiError } from '../src/api/api-error.ts';
import type { ClientErrorCode } from '../src/api/api-error.ts';
import { ERROR_COPY, errorCopy } from '../src/shared/error-copy.ts';
import { sharedCopy } from '../src/shared/shared-copy.ts';

const buildApiError = ({ code }: { code: ClientErrorCode }) =>
  new ApiError({ status: 0, code, message: 'detail the user must not see' });

describe('errorCopy', () => {
  it('tells the user to wait when the API is rate limited', () => {
    expect(errorCopy({ error: buildApiError({ code: 'too_many_requests' }) })).toBe(
      sharedCopy.errors.tooManyRequests,
    );
  });

  it('tells an unreachable server apart from an upstream that is down', () => {
    const unreachable = errorCopy({ error: buildApiError({ code: 'unreachable' }) });
    const upstreamDown = errorCopy({ error: buildApiError({ code: 'upstream_unavailable' }) });

    expect(unreachable).toBe(sharedCopy.errors.unreachable);
    expect(upstreamDown).toBe(sharedCopy.errors.upstreamUnavailable);
    expect(unreachable).not.toBe(upstreamDown);
  });

  it('never shows the raw error message', () => {
    for (const code of Object.keys(ERROR_COPY) as ClientErrorCode[]) {
      expect(errorCopy({ error: buildApiError({ code }) })).not.toContain('detail');
    }
  });

  it.each([new Error('boom'), 'boom', undefined, null])(
    'falls back to the generic copy for %j, which is not an ApiError',
    (error) => {
      expect(errorCopy({ error })).toBe(sharedCopy.errors.unexpected);
    },
  );
});
