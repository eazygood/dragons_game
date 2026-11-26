import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_RESPONSE_BYTES } from '../../src/adapters/mugloar-api-adapter/response-body.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import * as mugloarRepository from '../../src/repositories/mugloar-repository.ts';
import { FETCH_STUB_BASE_URL, openBody, stubFetch } from '../support/fetch-stub.ts';
import { LIVE_AD, pointAdapterAt } from '../support/mugloar-api.ts';
import { startStubServer } from '../support/stub-server.ts';
import type { StubServer } from '../support/stub-server.ts';

const CHUNK_BYTES = 64 * 1024;
const BOUNDED_MESSAGE_BYTES = MAX_RESPONSE_BYTES - 1024;

let stub: StubServer;

beforeAll(async () => {
  stub = await startStubServer();
});

afterAll(() => stub.close());

beforeEach(() => {
  stub.reset();
  pointAdapterAt({ baseUrl: stub.baseUrl });
});

describe('mugloar api: response size cap', () => {
  it('reads a large response that is still under the cap', async () => {
    stub.get('/:gameId/messages', () => [
      { ...LIVE_AD, message: 'x'.repeat(BOUNDED_MESSAGE_BYTES) },
    ]);

    const result = await mugloarRepository.findAds({ gameId: 'g1' });

    expect(result).toMatchObject({ status: 'ok', value: { ads: [{ adId: LIVE_AD.adId }] } });
  });

  it('rejects a response whose content-length is over the cap, unread', async () => {
    const cancelled = vi.fn();

    stubFetch(
      new Response(openBody({ onCancel: cancelled }), {
        headers: { 'content-length': String(MAX_RESPONSE_BYTES + 1) },
      }),
    );
    pointAdapterAt({ baseUrl: FETCH_STUB_BASE_URL });

    await expect(mugloarRepository.findAds({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('stops reading a stream that outgrows the cap without declaring a length', async () => {
    const cancelled = vi.fn();
    let chunksPulled = 0;
    const endlessBody = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        chunksPulled += 1;
        controller.enqueue(new Uint8Array(CHUNK_BYTES));
      },
      cancel: cancelled,
    });

    stubFetch(new Response(endlessBody));
    pointAdapterAt({ baseUrl: FETCH_STUB_BASE_URL });

    await expect(mugloarRepository.findAds({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
    expect(cancelled).toHaveBeenCalledOnce();
    expect(chunksPulled).toBeLessThan(2 * (MAX_RESPONSE_BYTES / CHUNK_BYTES));
  });

  it('does not let an oversized error body decide the failure', async () => {
    stub.post('/:gameId/shop/buy/:itemId', () => [
      502,
      `<html>${'x'.repeat(MAX_RESPONSE_BYTES)}</html>`,
    ]);

    await expect(
      mugloarRepository.buyItem({ gameId: 'g1', itemId: 'hpot' }),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });
});
