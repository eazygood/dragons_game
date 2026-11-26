import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { mugloarApiAdapter } from '../../src/adapters/mugloar-api-adapter/index.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import {
  adAttemptRepository,
  adRepository,
  gameRunRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';
import { FETCH_STUB_BASE_URL, failureOf, openBody, stubFetch } from '../support/fetch-stub.ts';
import { LIVE_AD, pointAdapterAt } from '../support/mugloar-api.ts';
import { startStubServer } from '../support/stub-server.ts';
import type { StubServer } from '../support/stub-server.ts';

const TEMPORARY_REDIRECT = 307;
const HUNG_BACKOFF_MS = 60_000;
const PROMPT_ABORT_MS = 2000;

describe('mugloar api: hardened fetch', () => {
  let stub: StubServer;

  beforeAll(async () => {
    stub = await startStubServer();
  });

  afterAll(() => stub.close());

  beforeEach(() => {
    stub.reset();
    pointAdapterAt({ baseUrl: stub.baseUrl });
  });

  describe('redirects', () => {
    it('fails on a redirect instead of following it to another host', async () => {
      stub.post('/game/start', () => [
        TEMPORARY_REDIRECT,
        '',
        { location: `${stub.baseUrl}/elsewhere` },
      ]);
      stub.post('/elsewhere', () => ({ gameId: 'hijacked' }));

      await expect(gameRunRepository.mugloar.createOne()).rejects.toBeInstanceOf(
        UpstreamUnavailableError,
      );
      expect(stub.callCount('/elsewhere')).toBe(0);
    });
  });

  describe('unused response bodies', () => {
    it('cancels the body of a 5xx that a retry replaces', async () => {
      const cancelled = vi.fn();
      const fetchStub = stubFetch(
        new Response(openBody({ onCancel: cancelled }), { status: 503 }),
        Response.json([LIVE_AD]),
      );

      pointAdapterAt({ baseUrl: FETCH_STUB_BASE_URL });

      await expect(adRepository.mugloar.findMany({ gameId: 'g1' })).resolves.toMatchObject({
        status: 'ok',
      });
      expect(fetchStub).toHaveBeenCalledTimes(2);
      expect(cancelled).toHaveBeenCalledOnce();
    });

    it('cancels the body of the 410 that ends the game', async () => {
      const cancelled = vi.fn();

      stubFetch(new Response(openBody({ onCancel: cancelled }), { status: 410 }));
      pointAdapterAt({ baseUrl: FETCH_STUB_BASE_URL });

      await expect(
        adAttemptRepository.mugloar.createOne({ gameId: 'g1', adId: 'a1' }),
      ).resolves.toEqual({ status: 'game_over' });
      expect(cancelled).toHaveBeenCalledOnce();
    });

    it('still fails with the status when the error body cannot be read', async () => {
      const unreadableBody = new ReadableStream<Uint8Array>({
        pull: (controller) => controller.error(new Error('socket hang up')),
      });

      stubFetch(new Response(unreadableBody, { status: 502 }));
      pointAdapterAt({ baseUrl: FETCH_STUB_BASE_URL });

      const failure = await failureOf(
        purchaseRepository.mugloar.createOne({ gameId: 'g1', itemId: 'hpot' }),
      );

      expect(failure).toBeInstanceOf(UpstreamUnavailableError);
      expect(String(failure?.cause)).toMatch(/→ 502: $/);
    });
  });

  describe('abort signal', () => {
    const listAds = ({ signal }: { signal: AbortSignal }) =>
      mugloarApiAdapter.request({
        operation: 'list_ads',
        method: 'GET',
        path: '/g1/messages',
        schema: z.array(z.unknown()),
        signal,
      });

    it('cuts a retry backoff short when the caller aborts', async () => {
      pointAdapterAt({
        baseUrl: stub.baseUrl,
        overrides: { mugloarRetryBaseDelayMs: HUNG_BACKOFF_MS },
      });
      stub.get('/:gameId/messages', () => [503, '<html>busy</html>']);

      const controller = new AbortController();
      const pending = failureOf(listAds({ signal: controller.signal }));
      const startedAt = performance.now();

      await vi.waitFor(() => expect(stub.callCount('/:gameId/messages')).toBe(1));
      controller.abort();

      expect(await pending).toBeInstanceOf(UpstreamUnavailableError);
      expect(performance.now() - startedAt).toBeLessThan(PROMPT_ABORT_MS);
      expect(stub.callCount('/:gameId/messages')).toBe(1);
    });

    it('sends nothing upstream for a signal that is already aborted', async () => {
      stub.get('/:gameId/messages', () => [LIVE_AD]);

      const failure = await failureOf(listAds({ signal: AbortSignal.abort() }));

      expect(failure).toBeInstanceOf(UpstreamUnavailableError);
      expect(stub.callCount('/:gameId/messages')).toBe(0);
    });
  });
});
