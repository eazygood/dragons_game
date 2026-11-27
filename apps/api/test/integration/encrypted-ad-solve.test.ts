import { TurnViewSchema } from '@dragons-game/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import { migrateFresh } from '../support/integration-db.ts';
import { LIVE_AD, pointAdapterAt } from '../support/mugloar-api.ts';
import { PLAYER_GAME_ID, newGameStartBody } from '../support/player-game.ts';
import { startStubServer } from '../support/stub-server.ts';
import type { StubServer } from '../support/stub-server.ts';

const ENCODED_AD_ID = 'cVlmaFlnRnQ=';
const DECODED_AD_ID = 'qYfhYgFt';
const BASE64_AD = {
  ...LIVE_AD,
  adId: ENCODED_AD_ID,
  message: Buffer.from(LIVE_AD.message).toString('base64'),
  probability: Buffer.from(LIVE_AD.probability).toString('base64'),
  encrypted: 1,
};
const SOLVE_SUCCESS = {
  success: true,
  lives: 3,
  gold: 17,
  score: 17,
  highScore: 17,
  turn: 1,
  message: 'You successfully solved the mission!',
};

// The decode lives in the adapter, but only a request through the route proves the id the
// board shows is the one that reaches the upstream solve URL; the encoded one is a 400 there.
describe('solving an encrypted ad through the API', () => {
  let app: FastifyInstance;
  let stub: StubServer;
  const upstreamSolvePaths: string[] = [];

  beforeAll(async () => {
    stub = await startStubServer();
    app = await buildApp({ config: loadConfig({ env: process.env }), logger: false });
    await migrateFresh({ db: app.db });
    // buildApp configures the adapter from the environment, so the stub must be set after it.
    pointAdapterAt({ baseUrl: stub.baseUrl });

    stub.post('/game/start', () => newGameStartBody(PLAYER_GAME_ID));
    stub.get('/:gameId/messages', () => [BASE64_AD]);
    stub.get('/:gameId/shop', () => []);
    stub.post('/:gameId/solve/:adId', ({ path }) => {
      upstreamSolvePaths.push(path);

      return SOLVE_SUCCESS;
    });
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
  });

  it('shows the decoded id on the board and sends it, not the encoded one, upstream', async () => {
    const started = await app.inject({ method: 'POST', url: '/api/games' });

    expect(started.statusCode).toBe(201);

    const turn = await app.inject({ url: `/api/games/${PLAYER_GAME_ID}/turn` });
    const boardAdIds = TurnViewSchema.parse(turn.json()).board.map(({ adId }) => adId);

    expect(boardAdIds).toEqual([DECODED_AD_ID]);

    const solved = await app.inject({
      method: 'POST',
      url: `/api/games/${PLAYER_GAME_ID}/ads/${DECODED_AD_ID}/solve`,
    });

    expect(solved.statusCode).toBe(200);
    expect(upstreamSolvePaths).toEqual([`/${PLAYER_GAME_ID}/solve/${DECODED_AD_ID}`]);
  });
});
