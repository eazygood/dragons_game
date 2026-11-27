import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { GameNotFoundError, UpstreamUnavailableError } from '../../src/errors/errors.ts';
import * as gameRepository from '../../src/repositories/game-repository/index.ts';
import { LIVE_AD, pointAdapterAt } from '../support/mugloar-api.ts';
import { startStubServer } from '../support/stub-server.ts';
import type { StubServer } from '../support/stub-server.ts';

const GAME_OVER: [number, unknown] = [410, { status: 'Game Over' }];
const SOLVE_SUCCESS = {
  success: true,
  lives: 3,
  gold: 20,
  score: 120,
  highScore: 900,
  turn: 4,
  message: 'You successfully solved the mission!',
};
const ENCODED_AD_ID = 'cVlmaFlnRnQ=';
const DECODED_AD_ID = 'qYfhYgFt';
const BASE64_AD = {
  ...LIVE_AD,
  adId: ENCODED_AD_ID,
  message: Buffer.from(LIVE_AD.message).toString('base64'),
  probability: Buffer.from(LIVE_AD.probability).toString('base64'),
  encrypted: 1,
};

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
  it('turns a 410 into a terminal game_over result instead of throwing', async () => {
    stub.post('/:gameId/solve/:adId', () => GAME_OVER);

    await expect(gameRepository.mugloar.solveAd({ gameId: 'g1', adId: 'a1' })).resolves.toEqual({
      status: 'game_over',
    });
  });

  it('treats a 410 on a read as game_over too, not only on messages', async () => {
    stub.get('/:gameId/shop', () => GAME_OVER);

    await expect(gameRepository.mugloar.findShopItems({ gameId: 'g1' })).resolves.toEqual({
      status: 'game_over',
    });
  });

  it('maps a 404 on a write to GameNotFoundError', async () => {
    stub.post('/:gameId/shop/buy/:itemId', () => [404, '<html>Not Found</html>']);

    await expect(
      gameRepository.mugloar.buyItem({ gameId: 'g1', itemId: 'hpot' }),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('rejects a 200 whose body does not match the contract', async () => {
    stub.get('/:gameId/shop', () => [{ id: 'hpot' }]);

    await expect(gameRepository.mugloar.findShopItems({ gameId: 'g1' })).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });

  it.each([
    ['an unknown probability label', { probability: 'Absolutely fine' }],
    ['an unknown encryption scheme', { encrypted: 7 }],
    ['a reward sent as a string, as the published docs claim', { reward: '17' }],
  ])('drops an ad with %s and keeps the rest of the board', async (_name, override) => {
    stub.get('/:gameId/messages', () => [{ ...LIVE_AD, adId: 'odd', ...override }, LIVE_AD]);

    await expect(gameRepository.mugloar.findAds({ gameId: 'g1' })).resolves.toEqual({
      status: 'ok',
      value: { ads: [expect.objectContaining({ adId: LIVE_AD.adId })], droppedCount: 1 },
    });
  });

  it('treats a 400 outside solve as an upstream failure, not an expired ad', async () => {
    stub.post('/:gameId/shop/buy/:itemId', () => [400, '<html>Bad Request</html>']);

    await expect(
      gameRepository.mugloar.buyItem({ gameId: 'g1', itemId: 'hpot' }),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it('keeps the upstream path and HTML body out of the message, in the cause only', async () => {
    stub.get('/:gameId/messages', () => [503, '<html><body>busy</body></html>']);

    const failure: unknown = await gameRepository.mugloar
      .findAds({ gameId: 'secret-game' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UpstreamUnavailableError);
    expect((failure as Error).message).not.toMatch(/secret-game|messages|html|503/);
    expect(String((failure as Error).cause)).toMatch(/secret-game\/messages.*503.*<html>/);
  });

  it('solves with the decoded ad id, since the encoded one is a 400 upstream', async () => {
    let solvedPath: string | undefined;

    stub.get('/:gameId/messages', () => [BASE64_AD]);
    stub.post('/:gameId/solve/:adId', ({ path }) => {
      solvedPath = path;

      return SOLVE_SUCCESS;
    });

    const board = await gameRepository.mugloar.findAds({ gameId: 'g1' });

    if (board.status !== 'ok') {
      throw new Error('expected a board');
    }

    const [ad] = board.value.ads;

    await gameRepository.mugloar.solveAd({ gameId: 'g1', adId: ad?.adId ?? '' });

    expect(ad?.adId).toBe(DECODED_AD_ID);
    expect(solvedPath).toBe(`/g1/solve/${DECODED_AD_ID}`);
  });
});
