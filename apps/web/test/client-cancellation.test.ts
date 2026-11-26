import { GameViewSchema } from '@bigbank-dragon/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UNREACHABLE_STATUS } from '../src/api/api-error.ts';
import { apiRequest } from '../src/api/client.ts';
import { jsonResponse, stubApi } from './fetch-stub.ts';
import { GAME_VIEW } from './fixtures.ts';

describe('apiRequest cancellation and timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Like real fetch: an already-aborted signal rejects at once, a live one rejects on abort.
  const rejectWhenAborted = (_path: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      // Always a DOMException here, which fetch rejects with as-is.
      const abortReason = () => signal?.reason as Error;

      if (signal?.aborted) {
        reject(abortReason());
      }

      signal?.addEventListener('abort', () => reject(abortReason()));
    });

  const requestGame = ({ signal }: { signal?: AbortSignal } = {}) =>
    apiRequest({ path: '/api/games/g1', schema: GameViewSchema, signal });

  it('rethrows the abort itself when the caller cancels, so Query does not see a failure', async () => {
    vi.stubGlobal('fetch', rejectWhenAborted);
    const controller = new AbortController();

    const request = requestGame({ signal: controller.signal });

    controller.abort();

    await expect(request).rejects.toBe(controller.signal.reason);
  });

  it('rethrows the abort when the caller had already cancelled', async () => {
    vi.stubGlobal('fetch', rejectWhenAborted);
    const controller = new AbortController();

    controller.abort();

    await expect(requestGame({ signal: controller.signal })).rejects.toBe(controller.signal.reason);
  });

  it('reports a request that never answers as unreachable', async () => {
    vi.stubGlobal('fetch', rejectWhenAborted);

    const request = expect(requestGame()).rejects.toMatchObject({
      status: UNREACHABLE_STATUS,
      code: 'unreachable',
    });

    await vi.runAllTimersAsync();
    await request;
  });

  it('leaves no timer behind once a request settles', async () => {
    stubApi({ 'GET /api/games/g1': () => jsonResponse({ status: 200, body: GAME_VIEW }) });

    await requestGame({ signal: new AbortController().signal });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops listening to the caller once a request settles', async () => {
    stubApi({ 'GET /api/games/g1': () => jsonResponse({ status: 200, body: GAME_VIEW }) });
    const { signal } = new AbortController();
    const addListener = vi.spyOn(signal, 'addEventListener');
    const removeListener = vi.spyOn(signal, 'removeEventListener');

    await requestGame({ signal });

    const [, forwardAbort] = addListener.mock.calls[0] ?? [];

    expect(removeListener).toHaveBeenCalledWith('abort', forwardAbort);
  });

  describe('in a browser without AbortSignal.any', () => {
    const original = Object.getOwnPropertyDescriptor(AbortSignal, 'any');

    beforeEach(() => {
      Reflect.deleteProperty(AbortSignal, 'any');
    });

    afterEach(() => {
      if (original) {
        Object.defineProperty(AbortSignal, 'any', original);
      }
    });

    it('still loads data', async () => {
      stubApi({ 'GET /api/games/g1': () => jsonResponse({ status: 200, body: GAME_VIEW }) });

      expect('any' in AbortSignal).toBe(false);
      await expect(requestGame({ signal: new AbortController().signal })).resolves.toEqual(
        GAME_VIEW,
      );
    });

    it('still honours the caller cancelling', async () => {
      vi.stubGlobal('fetch', rejectWhenAborted);
      const controller = new AbortController();

      const request = requestGame({ signal: controller.signal });

      controller.abort();

      await expect(request).rejects.toBe(controller.signal.reason);
    });

    it('still times out a stalled request', async () => {
      vi.stubGlobal('fetch', rejectWhenAborted);

      const request = expect(
        requestGame({ signal: new AbortController().signal }),
      ).rejects.toMatchObject({ code: 'unreachable' });

      await vi.runAllTimersAsync();
      await request;
    });
  });
});
