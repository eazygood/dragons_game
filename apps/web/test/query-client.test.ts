import { describe, expect, it } from 'vitest';

import { ApiError } from '../src/api/api-error.ts';
import { createQueryClient, shouldRetryRead } from '../src/query-client.ts';

const networkDown = new ApiError({ status: 0, code: 'unreachable', message: 'offline' });
const upstreamDown = new ApiError({ status: 502, code: 'upstream_unavailable', message: 'down' });
const adExpired = new ApiError({ status: 409, code: 'conflict', message: 'gone' });

describe('shouldRetryRead', () => {
  it('retries a dropped connection and a 5xx', () => {
    expect(shouldRetryRead({ failureCount: 0, error: networkDown })).toBe(true);
    expect(shouldRetryRead({ failureCount: 1, error: upstreamDown })).toBe(true);
  });

  it('stops after two retries', () => {
    expect(shouldRetryRead({ failureCount: 2, error: upstreamDown })).toBe(false);
  });

  it('never retries a 4xx answer', () => {
    expect(shouldRetryRead({ failureCount: 0, error: adExpired })).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('never retries a mutation, because solve and buy are not idempotent', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
