import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import {
  adAttemptRepository,
  adRepository,
  purchaseRepository,
  shopItemRepository,
} from '../../src/repositories/index.ts';
import { LIVE_AD, pointAdapterAt } from '../support/mugloar-api.ts';
import { startStubServer } from '../support/stub-server.ts';
import type { StubServer } from '../support/stub-server.ts';

const GAME_OVER: [number, unknown] = [410, { status: 'Game Over' }];

let stub: StubServer;

beforeAll(async () => {
  stub = await startStubServer();
});

afterAll(() => stub.close());

beforeEach(() => {
  stub.reset();
  pointAdapterAt({ baseUrl: stub.baseUrl });
});

describe('mugloar api: shapes and errors', () => {
  it('reads /messages as a bare array, not { messages: [...] }', async () => {
    stub.get('/:gameId/messages', () => [LIVE_AD]);

    const result = await adRepository.mugloar.findMany({ gameId: 'g1' });

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

    await expect(adRepository.mugloar.findMany({ gameId: 'g1' })).resolves.toMatchObject({
      value: [{ adId: 'qYfhYgFt', probability: 'Gamble', wasEncrypted: true }],
    });
  });

  it('turns a 410 into a terminal game_over result instead of throwing', async () => {
    stub.post('/:gameId/solve/:adId', () => GAME_OVER);

    await expect(
      adAttemptRepository.mugloar.createOne({ gameId: 'g1', adId: 'a1' }),
    ).resolves.toEqual({
      status: 'game_over',
    });
  });

  // Review Focus #2
  it('rejects a 200 whose body does not match the contract', async () => {
    stub.get('/:gameId/shop', () => [{ id: 'hpot' }]);

    await expect(shopItemRepository.mugloar.findMany({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it('drops an ad with an unknown probability label and keeps the rest of the board', async () => {
    stub.get('/:gameId/messages', () => [
      { ...LIVE_AD, adId: 'odd', probability: 'Absolutely fine' },
      LIVE_AD,
    ]);

    await expect(adRepository.mugloar.findMany({ gameId: 'g1' })).resolves.toEqual({
      status: 'ok',
      value: [expect.objectContaining({ adId: LIVE_AD.adId })],
    });
  });

  it('drops an ad with an unknown encryption scheme and keeps the rest of the board', async () => {
    stub.get('/:gameId/messages', () => [{ ...LIVE_AD, adId: 'odd', encrypted: 7 }, LIVE_AD]);

    await expect(adRepository.mugloar.findMany({ gameId: 'g1' })).resolves.toEqual({
      status: 'ok',
      value: [expect.objectContaining({ adId: LIVE_AD.adId })],
    });
  });

  it('treats a 400 outside solve as an upstream failure, not an expired ad', async () => {
    stub.post('/:gameId/shop/buy/:itemId', () => [400, '<html>Bad Request</html>']);

    await expect(
      purchaseRepository.mugloar.createOne({ gameId: 'g1', itemId: 'hpot' }),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it('keeps the upstream path and HTML body out of the message, in the cause only', async () => {
    stub.get('/:gameId/messages', () => [503, '<html><body>busy</body></html>']);

    const failure: unknown = await adRepository.mugloar
      .findMany({ gameId: 'secret-game' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UpstreamUnavailableError);
    expect((failure as Error).message).not.toMatch(/secret-game|messages|html|503/);
    expect(String((failure as Error).cause)).toMatch(/secret-game\/messages.*503.*<html>/);
  });

  // Verified live 2026-11-23: /shop is a bare array, like /messages. No /shop read was recorded.
  it('reads the shop as a bare array', async () => {
    stub.get('/:gameId/shop', () => [{ id: 'hpot', name: 'Healing potion', cost: 50 }]);

    await expect(shopItemRepository.mugloar.findMany({ gameId: 'g1' })).resolves.toEqual({
      status: 'ok',
      value: [{ id: 'hpot', name: 'Healing potion', cost: 50 }],
    });
  });
});
