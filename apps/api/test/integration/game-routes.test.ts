import { GameViewSchema, MoveResultSchema, TurnViewSchema } from '@bigbank-dragon/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/entities/db-tables.ts';
import { UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { startGame } from '../../src/managers/game-manager/index.ts';
import {
  adAttemptRepository,
  adRepository,
  gameRunRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';
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
    await startGame({ db: app.db, strategy: 'manual' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts a manual game', async () => {
    vi.mocked(gameRunRepository.mugloar.createOne).mockResolvedValueOnce(newGameSnapshot('fresh'));

    const response = await app.inject({ method: 'POST', url: '/api/games' });

    expect(response.statusCode).toBe(201);
    expect(GameViewSchema.parse(response.json())).toMatchObject({
      status: 'active',
      state: { gameId: 'fresh', lives: 3 },
    });
    expect(await gameRunRepository.db.findOne({ db: app.db, gameId: 'fresh' })).toMatchObject({
      strategy: 'manual',
    });
  });

  it('reports a game from the database alone', async () => {
    const response = await app.inject({ url: `/api/games/${gameId}` });

    expect(GameViewSchema.parse(response.json())).toMatchObject({ status: 'active' });
    expect(adRepository.mugloar.findMany).not.toHaveBeenCalled();
  });

  it('serves the turn with advice that parses as a contract', async () => {
    const response = await app.inject({ url: `/api/games/${gameId}/turn` });
    const body = TurnViewSchema.parse(response.json());

    expect(body.board[0]?.advice.verdict).toBe('recommended');
    expect(body.recommendation).toMatchObject({ kind: 'solve', adId: 'sure1' });
  });

  // Review Focus #4
  it.each(['bad!id', 'cVlmaFlnRnQ%3D', 'a'.repeat(65)])(
    'rejects game id %s before any upstream call',
    async (id) => {
      const response = await app.inject({ url: `/api/games/${id}/turn` });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
      expect(adRepository.mugloar.findMany).not.toHaveBeenCalled();
    },
  );

  it('maps an expired ad to 409', async () => {
    const url = `/api/games/${gameId}/ads/vanished/solve`;

    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(409);
  });

  it('maps insufficient gold to 409 without buying', async () => {
    const url = `/api/games/${gameId}/shop/hpot/buy`;

    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(409);
    expect(purchaseRepository.mugloar.createOne).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown game', async () => {
    const response = await app.inject({ url: '/api/games/nope/turn' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('returns 409 for a bot game', async () => {
    vi.mocked(gameRunRepository.mugloar.createOne).mockResolvedValueOnce(
      newGameSnapshot('bot-game'),
    );
    await startGame({ db: app.db, strategy: 'calibrated' });

    const response = await app.inject({ url: '/api/games/bot-game/turn' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'conflict' } });
  });

  // Review Focus #5
  it('answers 410 on game over and then reports the finished game', async () => {
    vi.mocked(adRepository.mugloar.findMany).mockResolvedValue({ status: 'game_over' });

    const turn = await app.inject({ url: `/api/games/${gameId}/turn` });

    expect(turn.statusCode).toBe(410);
    expect(turn.json()).toEqual({ error: { code: 'game_over', message: 'Game over' } });
    expect((await app.inject({ url: `/api/games/${gameId}` })).json()).toMatchObject({
      status: 'game_over',
    });
  });

  // Review Focus #5
  it('answers 410 when the solve itself is game over, and plays no further moves', async () => {
    const url = `/api/games/${gameId}/ads/sure1/solve`;

    vi.mocked(adAttemptRepository.mugloar.createOne).mockResolvedValue({ status: 'game_over' });

    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(410);
    expect(await gameRunRepository.db.findOne({ db: app.db, gameId })).toMatchObject({
      status: 'game_over',
      endedAt: expect.any(Date) as Date,
    });

    vi.mocked(adAttemptRepository.mugloar.createOne).mockClear();

    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(410);
    expect(adAttemptRepository.mugloar.createOne).not.toHaveBeenCalled();
  });

  it('maps an unreachable upstream to 502', async () => {
    vi.mocked(adRepository.mugloar.findMany).mockRejectedValue(
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
