import { GameViewSchema, MoveResultSchema, TurnViewSchema } from '@dragons-game/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { startGameRun } from '../../src/managers/game-manager/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import * as gameRepository from '../../src/repositories/game-repository/index.ts';
import { PLAYER_GAME_ID, newGameSnapshot, stubPlayerUpstream } from '../support/player-game.ts';

const gameId = PLAYER_GAME_ID;

describe('game routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ env: process.env }), logger: false });
    await app.db.migrate.rollback(undefined, true);
    await app.db.migrate.latest();
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    await app.db(DbTables.GameRuns).delete();
    stubPlayerUpstream();
    await startGameRun({ db: app.db, strategy: 'manual' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts a manual game', async () => {
    vi.mocked(gameRepository.mugloar.startGame).mockResolvedValueOnce(newGameSnapshot('fresh'));

    const response = await app.inject({ method: 'POST', url: '/api/games' });

    expect(response.statusCode).toBe(201);
    expect(GameViewSchema.parse(response.json())).toMatchObject({
      status: 'active',
      state: { gameId: 'fresh', lives: 3 },
    });
    expect(await gameRepository.db.findOne({ db: app.db, gameId: 'fresh' })).toMatchObject({
      strategy: 'manual',
    });
  });

  it('reports a game from the database alone', async () => {
    const response = await app.inject({ url: `/api/games/${gameId}` });

    expect(GameViewSchema.parse(response.json())).toMatchObject({ status: 'active' });
    expect(gameRepository.mugloar.findAds).not.toHaveBeenCalled();
  });

  it('serves the turn with advice that parses as a contract', async () => {
    const response = await app.inject({ url: `/api/games/${gameId}/turn` });
    const body = TurnViewSchema.parse(response.json());

    expect(body.board[0]?.advice.verdict).toBe('recommended');
    expect(body.recommendation).toMatchObject({ kind: 'solve', adId: 'sure1' });
  });

  // Each game-id route declares its own params schema, so each is checked.
  it.each([
    ...['bad!id', 'cVlmaFlnRnQ%3D', 'a'.repeat(65)].map((id) => ({ id, route: '/turn' })),
    { id: 'bad!id', route: '' },
    { id: 'bad!id', route: '/moves' },
  ])(
    'rejects game id $id on /api/games/:id$route before any upstream call',
    async ({ id, route }) => {
      const response = await app.inject({ url: `/api/games/${id}${route}` });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
      expect(gameRepository.mugloar.findAds).not.toHaveBeenCalled();
    },
  );

  it.each([
    { refusal: 'an expired ad', url: `/api/games/${gameId}/ads/vanished/solve` },
    { refusal: 'insufficient gold', url: `/api/games/${gameId}/shop/hpot/buy` },
  ])('maps $refusal to 409 conflict', async ({ url }) => {
    const response = await app.inject({ method: 'POST', url });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'conflict' } });
  });

  it('returns 404 for an unknown game', async () => {
    const response = await app.inject({ url: '/api/games/nope/turn' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('returns 409 for a bot game', async () => {
    vi.mocked(gameRepository.mugloar.startGame).mockResolvedValueOnce(newGameSnapshot('bot-game'));
    await startGameRun({ db: app.db, strategy: 'calibrated' });

    const response = await app.inject({ url: '/api/games/bot-game/turn' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'conflict' } });
  });

  it('answers 410 on game over and then reports the finished game', async () => {
    vi.mocked(gameRepository.mugloar.findAds).mockResolvedValue({ status: 'game_over' });

    const turn = await app.inject({ url: `/api/games/${gameId}/turn` });

    expect(turn.statusCode).toBe(410);
    expect(turn.json()).toEqual({ error: { code: 'game_over', message: 'Game over' } });
    expect((await app.inject({ url: `/api/games/${gameId}` })).json()).toMatchObject({
      status: 'game_over',
    });
  });

  it('answers 410 when the solve itself is game over, and ends the run', async () => {
    const url = `/api/games/${gameId}/ads/sure1/solve`;

    vi.mocked(gameRepository.mugloar.solveAd).mockResolvedValue({ status: 'game_over' });

    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(410);
    expect(await gameRepository.db.findOne({ db: app.db, gameId })).toMatchObject({
      status: 'game_over',
      endedAt: expect.any(Date) as Date,
    });
  });

  it('maps an unreachable upstream to 502', async () => {
    vi.mocked(gameRepository.mugloar.findAds).mockRejectedValue(
      new UpstreamUnavailableError({ message: 'down' }),
    );

    expect((await app.inject({ url: `/api/games/${gameId}/turn` })).statusCode).toBe(502);
  });

  it('returns the move result after a solve', async () => {
    const url = `/api/games/${gameId}/ads/sure1/solve`;
    const response = await app.inject({ method: 'POST', url });

    expect(response.statusCode).toBe(200);
    expect(MoveResultSchema.parse(response.json())).toMatchObject({
      success: true,
      message: 'You did it',
      game: { status: 'active', state: { gold: 30, turn: 1 } },
    });
  });
});
