import { onlineManager } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { MutationObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../src/api/api-error.ts';
import { createQueryClient } from '../src/query-client.ts';

const networkDown = new ApiError({ status: 0, code: 'unreachable', message: 'offline' });
const upstreamDown = new ApiError({ status: 502, code: 'upstream_unavailable', message: 'down' });
const adExpired = new ApiError({ status: 409, code: 'conflict', message: 'gone' });

const QUERY_KEY = ['probe'];

const failingRead = ({ error }: { error: Error }) => vi.fn(() => Promise.reject(error));

const fetchProbe = ({
  queryClient,
  queryFn,
}: {
  queryClient: QueryClient;
  queryFn: () => Promise<unknown>;
}) => queryClient.fetchQuery({ queryKey: QUERY_KEY, queryFn });

describe('read retries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const settle = async ({ outcome }: { outcome: Promise<unknown> }) => {
    const settled = outcome.catch((error: unknown) => error);

    await vi.runAllTimersAsync();

    return settled;
  };

  it('retries a dropped connection twice before giving up', async () => {
    const queryFn = failingRead({ error: networkDown });

    await settle({ outcome: fetchProbe({ queryClient: createQueryClient(), queryFn }) });

    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('retries a 5xx', async () => {
    const queryFn = failingRead({ error: upstreamDown });

    await settle({ outcome: fetchProbe({ queryClient: createQueryClient(), queryFn }) });

    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('never retries a 4xx answer', async () => {
    const queryFn = failingRead({ error: adExpired });

    await settle({ outcome: fetchProbe({ queryClient: createQueryClient(), queryFn }) });

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('never retries a mutation, because solve and buy are not idempotent', async () => {
    const mutationFn = failingRead({ error: upstreamDown });
    const observer = new MutationObserver(createQueryClient(), { mutationFn });

    await settle({ outcome: observer.mutate() });

    expect(mutationFn).toHaveBeenCalledTimes(1);
  });
});

describe('while the browser reports it is offline', () => {
  beforeEach(() => {
    onlineManager.setOnline(false);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('still runs a read, so the failure shows instead of an endless spinner', async () => {
    const result = await fetchProbe({
      queryClient: createQueryClient(),
      queryFn: () => Promise.resolve('fetched'),
    });

    expect(result).toBe('fetched');
  });

  it('still runs a mutation now, instead of queueing it until reconnect', async () => {
    const observer = new MutationObserver(createQueryClient(), {
      mutationFn: () => Promise.resolve('sent'),
    });

    await expect(observer.mutate()).resolves.toBe('sent');
  });
});
