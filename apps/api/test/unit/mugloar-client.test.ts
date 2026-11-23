import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { MugloarClient } from '../../src/adapters/mugloar-api-adapter/index.ts';
import {
  AdExpiredError,
  GameNotFoundError,
  UpstreamUnavailableError,
} from '../../src/errors/errors.ts';
import { LIVE_AD, testClient } from '../support/mugloar-client.ts';
import { startStubServer } from '../support/stub-server.ts';
import type { StubServer } from '../support/stub-server.ts';

const GAME_OVER: [number, unknown] = [410, { status: 'Game Over' }];

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

describe('mugloar client: shapes and errors', () => {
  it('reads /messages as a bare array, not { messages: [...] }', async () => {
    stub.get('/:gameId/messages', () => [LIVE_AD]);

    const result = await client.fetchAds({ gameId: 'g1' });

    expect(result).toEqual({
      status: 'ok',
      value: [expect.objectContaining({ adId: 'BR0b2WyN' })],
    });
  });

  it('decodes encrypted ads before handing them over', async () => {
    const encoded = {
      ...LIVE_AD,
      adId: 'cVlmaFlnRnQ=',
      probability: Buffer.from('Gamble').toString('base64'),
      message: Buffer.from('Steal a goat').toString('base64'),
      encrypted: 1,
    };

    stub.get('/:gameId/messages', () => [encoded]);

    await expect(client.fetchAds({ gameId: 'g1' })).resolves.toMatchObject({
      value: [{ adId: 'qYfhYgFt', probability: 'Gamble', wasEncrypted: true }],
    });
  });

  it('turns a 410 into a terminal game_over result instead of throwing', async () => {
    stub.post('/:gameId/solve/:adId', () => GAME_OVER);

    await expect(client.solveAd({ gameId: 'g1', adId: 'a1' })).resolves.toEqual({
      status: 'game_over',
    });
  });

  it('returns game_over from a read endpoint too', async () => {
    stub.get('/:gameId/messages', () => GAME_OVER);

    await expect(client.fetchAds({ gameId: 'g1' })).resolves.toEqual({ status: 'game_over' });
  });

  it('survives an HTML error body on a 404', async () => {
    stub.get('/:gameId/messages', () => [404, '<html><body>Not found</body></html>']);

    await expect(client.fetchAds({ gameId: 'nope' })).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('maps a 400 on solve to an expired ad, HTML body and all', async () => {
    stub.post('/:gameId/solve/:adId', () => [400, '<html>Bad Request</html>']);

    await expect(client.solveAd({ gameId: 'g1', adId: 'stale' })).rejects.toBeInstanceOf(
      AdExpiredError,
    );
  });

  // Review Focus #2
  it('rejects a 200 whose body does not match the contract', async () => {
    stub.get('/:gameId/shop', () => ({ items: [{ id: 'hpot' }] }));

    await expect(client.fetchShop({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('rejects a 200 whose ad carries an unknown probability label', async () => {
    stub.get('/:gameId/messages', () => [{ ...LIVE_AD, probability: 'Absolutely fine' }]);

    await expect(client.fetchAds({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('reads shoppingSuccess as a boolean and unwraps the shop listing', async () => {
    stub.get('/:gameId/shop', () => ({
      items: [{ id: 'hpot', name: 'Healing potion', cost: 50 }],
    }));
    stub.post('/:gameId/shop/buy/:itemId', () => ({
      shoppingSuccess: false,
      gold: 10,
      lives: 3,
      level: 0,
      turn: 6,
    }));

    await expect(client.fetchShop({ gameId: 'g1' })).resolves.toEqual({
      status: 'ok',
      value: [{ id: 'hpot', name: 'Healing potion', cost: 50 }],
    });
    await expect(client.buyItem({ gameId: 'g1', itemId: 'hpot' })).resolves.toMatchObject({
      value: { shoppingSuccess: false, turn: 6 },
    });
  });
});
