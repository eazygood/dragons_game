import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { MugloarClient } from '../../src/adapters/mugloar-api-adapter/index.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { LIVE_AD, testClient } from '../support/mugloar-client.ts';
import { sleepForever, startStubServer } from '../support/stub-server.ts';
import type { StubServer } from '../support/stub-server.ts';

let stub: StubServer;
let client: MugloarClient;

beforeAll(async () => {
  stub = await startStubServer();
});

afterAll(() => stub.close());

beforeEach(() => {
  stub.reset();
  client = testClient({ baseUrl: stub.baseUrl });
});

describe('mugloar client: retries and transport failures', () => {
  it('retries a read on 500 and succeeds', async () => {
    stub.failTimes('/:gameId/messages', 1, 500).then(() => [LIVE_AD]);

    await expect(client.fetchAds({ gameId: 'g1' })).resolves.toMatchObject({ status: 'ok' });
    expect(stub.callCount('/:gameId/messages')).toBe(2);
  });

  it('gives up on a read after the configured retries', async () => {
    stub.get('/:gameId/messages', () => [503, '<html>busy</html>']);

    await expect(client.fetchAds({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
    expect(stub.callCount('/:gameId/messages')).toBe(3);
  });

  it('never retries solve, because it is not idempotent', async () => {
    stub.post('/:gameId/solve/:adId', () => [500, '<html>boom</html>']);

    await expect(client.solveAd({ gameId: 'g1', adId: 'a1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
    expect(stub.callCount('/:gameId/solve/:adId')).toBe(1);
  });

  it('never retries buy', async () => {
    stub.post('/:gameId/shop/buy/:itemId', () => [500, '<html>boom</html>']);

    await expect(client.buyItem({ gameId: 'g1', itemId: 'hpot' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
    expect(stub.callCount('/:gameId/shop/buy/:itemId')).toBe(1);
  });

  it('never retries a game start, so a lost response cannot leak a second game', async () => {
    stub.post('/game/start', () => [500, '<html>boom</html>']);

    await expect(client.startGame()).rejects.toBeInstanceOf(UpstreamUnavailableError);
    expect(stub.callCount('/game/start')).toBe(1);
  });

  it('fails with UpstreamUnavailableError when the request times out', async () => {
    stub.get('/:gameId/messages', () => sleepForever());

    await expect(client.fetchAds({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('fails with UpstreamUnavailableError when the upstream cannot be reached', async () => {
    const unreachable = testClient({ baseUrl: 'http://127.0.0.1:1' });

    await expect(unreachable.startGame()).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it('takes a throttle token before every outbound call', async () => {
    let tokens = 0;
    const counting = testClient({
      baseUrl: stub.baseUrl,
      throttle: { acquire: () => Promise.resolve(void (tokens += 1)) },
    });

    stub.failTimes('/:gameId/messages', 1, 500).then(() => [LIVE_AD]);
    await counting.fetchAds({ gameId: 'g1' });

    expect(tokens).toBe(2);
  });
});
