import { GameViewSchema } from '@bigbank-dragon/contracts';
import { describe, expect, it, vi } from 'vitest';

import { apiRequest } from '../src/api/client.ts';
import { gamePaths } from '../src/api/game-paths.ts';
import { jsonResponse, stubApi } from './fetch-stub.ts';
import { GAME_VIEW } from './fixtures.ts';

describe('apiRequest', () => {
  it('returns the parsed body', async () => {
    stubApi({ 'GET /api/games/g1': () => jsonResponse({ status: 200, body: GAME_VIEW }) });

    await expect(apiRequest({ path: '/api/games/g1', schema: GameViewSchema })).resolves.toEqual(
      GAME_VIEW,
    );
  });

  it('turns the error envelope into an ApiError', async () => {
    stubApi({
      'GET /api/x': () =>
        jsonResponse({ status: 409, body: { error: { code: 'conflict', message: 'Ad expired' } } }),
    });

    await expect(apiRequest({ path: '/api/x', schema: GameViewSchema })).rejects.toMatchObject({
      status: 409,
      code: 'conflict',
      message: 'Ad expired',
    });
  });

  it('survives an HTML error page', async () => {
    stubApi({ 'GET /api/x': () => new Response('<html>Bad gateway</html>', { status: 502 }) });

    await expect(apiRequest({ path: '/api/x', schema: GameViewSchema })).rejects.toMatchObject({
      status: 502,
      code: 'upstream_unavailable',
    });
  });

  it('refuses a 200 that breaks the contract', async () => {
    stubApi({ 'GET /api/x': () => jsonResponse({ status: 200, body: { state: null } }) });

    await expect(apiRequest({ path: '/api/x', schema: GameViewSchema })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('reports an unreachable API', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('fetch failed')));

    await expect(apiRequest({ path: '/api/x', schema: GameViewSchema })).rejects.toMatchObject({
      status: 0,
      code: 'unreachable',
    });
  });

  it('sends a bodiless POST without a JSON content type', async () => {
    const fetchStub = stubApi({
      'POST /api/games': () => jsonResponse({ status: 201, body: GAME_VIEW }),
    });

    await apiRequest({ path: '/api/games', method: 'POST', schema: GameViewSchema });

    expect(new Headers(fetchStub.mock.calls[0]?.[1]?.headers).has('content-type')).toBe(false);
  });
});

describe('gamePaths', () => {
  it('encodes path segments', () => {
    expect(gamePaths.solve({ gameId: 'g 1', adId: 'a/b' })).toBe(
      '/api/games/g%201/ads/a%2Fb/solve',
    );
  });
});
