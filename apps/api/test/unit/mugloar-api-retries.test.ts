import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import * as gameRepository from '../../src/repositories/game-repository/index.ts';
import { LIVE_AD, pointAdapterAt } from '../support/mugloar-api.ts';
import { sleepForever, startStubServer } from '../support/stub-server.ts';
import type { StubServer } from '../support/stub-server.ts';

let stub: StubServer;

beforeAll(async () => {
  stub = await startStubServer();
});

afterAll(() => stub.close());

beforeEach(() => {
  stub.reset();
  pointAdapterAt({ baseUrl: stub.baseUrl });
});

describe('mugloar api: retries and transport failures', () => {
  it('retries a read on 500 and succeeds', async () => {
    stub.failTimes('/:gameId/messages', 1, 500).then(() => [LIVE_AD]);

    await expect(gameRepository.mugloar.findAds({ gameId: 'g1' })).resolves.toMatchObject({
      status: 'ok',
    });
    expect(stub.callCount('/:gameId/messages')).toBe(2);
  });

  it('gives up on a read after the configured retries', async () => {
    stub.get('/:gameId/messages', () => [503, '<html>busy</html>']);

    await expect(gameRepository.mugloar.findAds({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
    expect(stub.callCount('/:gameId/messages')).toBe(3);
  });

  it('never retries solve, because it is not idempotent', async () => {
    stub.post('/:gameId/solve/:adId', () => [500, '<html>boom</html>']);

    await expect(
      gameRepository.mugloar.solveAd({ gameId: 'g1', adId: 'a1' }),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
    expect(stub.callCount('/:gameId/solve/:adId')).toBe(1);
  });

  it('never retries buy', async () => {
    stub.post('/:gameId/shop/buy/:itemId', () => [500, '<html>boom</html>']);

    await expect(
      gameRepository.mugloar.buyItem({ gameId: 'g1', itemId: 'hpot' }),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
    expect(stub.callCount('/:gameId/shop/buy/:itemId')).toBe(1);
  });

  it('never retries a game start, so a lost response cannot leak a second game', async () => {
    stub.post('/game/start', () => [500, '<html>boom</html>']);

    await expect(gameRepository.mugloar.startGame()).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
    expect(stub.callCount('/game/start')).toBe(1);
  });

  it('fails with UpstreamUnavailableError when the request times out', async () => {
    stub.get('/:gameId/messages', () => sleepForever());

    await expect(gameRepository.mugloar.findAds({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('fails with UpstreamUnavailableError when the upstream cannot be reached', async () => {
    pointAdapterAt({ baseUrl: 'http://127.0.0.1:1' });

    await expect(gameRepository.mugloar.startGame()).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('fails a request starved by the throttle instead of queueing it forever', async () => {
    pointAdapterAt({
      baseUrl: stub.baseUrl,
      overrides: { mugloarBurst: 1, mugloarRatePerSecond: 0.01, mugloarTimeoutMs: 50 },
    });
    stub.post('/:gameId/shop/buy/:itemId', () => [500, '<html>boom</html>']);

    await expect(
      gameRepository.mugloar.buyItem({ gameId: 'g1', itemId: 'hpot' }),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
    await expect(
      gameRepository.mugloar.buyItem({ gameId: 'g1', itemId: 'hpot' }),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
    expect(stub.callCount('/:gameId/shop/buy/:itemId')).toBe(1);
  });
});
