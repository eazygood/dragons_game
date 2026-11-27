import { MoveListSchema } from '@dragons-game/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config/index.ts';
import type { AdAttempt } from '../../src/entities/ad-attempt.ts';
import type { GameRunId } from '../../src/entities/game-run.ts';
import { startGameRun } from '../../src/managers/game-manager/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';
import * as adAttemptRepository from '../../src/repositories/ad-attempt-repository.ts';
import * as purchaseRepository from '../../src/repositories/purchase-repository.ts';
import * as gameRepository from '../../src/repositories/game-repository/index.ts';
import {
  PLAYER_GAME_ID,
  newGameState,
  solvedAdResponse,
  stubPlayerUpstream,
} from '../support/player-game.ts';

const MOVES_URL = `/api/games/${PLAYER_GAME_ID}/moves`;
const CREATED_AT = new Date('2026-11-24T10:00:00.000Z');

const attemptOf = ({ gameRunId, turn }: Pick<AdAttempt, 'gameRunId' | 'turn'>): AdAttempt => ({
  gameRunId,
  adId: `ad-${turn}`,
  probability: 'Gamble',
  dragonLevel: 0,
  turn,
  reward: 50,
  success: false,
  estimatedProbability: 0.5,
  expectedValue: -5,
  rule: 'best_expected_value',
  createdAt: CREATED_AT,
});

describe('game moves route', () => {
  let app: FastifyInstance;
  let runId: GameRunId;

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ env: process.env }), logger: false });
    await app.db.migrate.rollback(undefined, true);
    await app.db.migrate.latest();
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    await app.db(DbTables.GameRuns).delete();
    stubPlayerUpstream();
    ({
      run: { id: runId },
    } = await startGameRun({ db: app.db, strategy: 'manual' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists a game's moves newest first, solves and purchases together", async () => {
    vi.mocked(gameRepository.mugloar.solveAd).mockResolvedValue(solvedAdResponse({ gold: 60 }));
    vi.mocked(gameRepository.mugloar.buyItem).mockResolvedValue({
      status: 'ok',
      value: { success: true, gold: 10, lives: 4, level: 0, turn: 2 },
    });

    await app.inject({ method: 'POST', url: `/api/games/${PLAYER_GAME_ID}/ads/sure1/solve` });
    await app.inject({ method: 'POST', url: `/api/games/${PLAYER_GAME_ID}/shop/hpot/buy` });

    const response = await app.inject({ url: MOVES_URL });
    const moves = MoveListSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(moves.map(({ kind }) => kind)).toEqual(['buy', 'solve']);
    expect(moves[0]).toMatchObject({
      kind: 'buy',
      rule: 'player_choice',
      itemName: 'Healing potion',
    });
    expect(moves[1]).toMatchObject({ kind: 'solve', rule: 'player_choice', turn: 1 });
  });

  it('orders interleaved solves and purchases by turn, newest first', async () => {
    await adAttemptRepository.createOne({
      db: app.db,
      attempt: attemptOf({ gameRunId: runId, turn: 1 }),
    });
    await purchaseRepository.createOne({
      db: app.db,
      purchase: {
        gameRunId: runId,
        itemId: 'hpot',
        itemName: 'Healing potion',
        rule: 'survival_floor',
        cost: 50,
        turn: 2,
        success: true,
        createdAt: CREATED_AT,
      },
    });
    await adAttemptRepository.createOne({
      db: app.db,
      attempt: attemptOf({ gameRunId: runId, turn: 3 }),
    });

    const moves = MoveListSchema.parse((await app.inject({ url: MOVES_URL })).json());

    expect(moves.map(({ kind, turn }) => `${kind}@${turn}`)).toEqual([
      'solve@3',
      'buy@2',
      'solve@1',
    ]);
  });

  it('answers a legacy move with a null rule', async () => {
    await adAttemptRepository.createOne({
      db: app.db,
      attempt: { ...attemptOf({ gameRunId: runId, turn: 1 }), rule: null },
    });
    await purchaseRepository.createOne({
      db: app.db,
      purchase: {
        gameRunId: runId,
        itemId: 'hpot',
        itemName: null,
        rule: null,
        cost: 50,
        turn: 2,
        success: true,
        createdAt: CREATED_AT,
      },
    });

    const moves = MoveListSchema.parse((await app.inject({ url: MOVES_URL })).json());

    expect(moves).toMatchObject([
      { kind: 'buy', rule: null, itemName: null },
      { kind: 'solve', rule: null },
    ]);
  });

  it("lists a bot game's moves, which the player routes refuse", async () => {
    vi.mocked(gameRepository.mugloar.startGame).mockResolvedValueOnce(newGameState('bot-moves'));
    const { run } = await startGameRun({ db: app.db, strategy: 'calibrated' });

    await adAttemptRepository.createOne({
      db: app.db,
      attempt: attemptOf({ gameRunId: run.id, turn: 1 }),
    });

    const response = await app.inject({ url: '/api/games/bot-moves/moves' });

    expect(response.statusCode).toBe(200);
    expect(MoveListSchema.parse(response.json())).toHaveLength(1);
  });

  it('answers an empty list for a game that has made no moves', async () => {
    expect((await app.inject({ url: MOVES_URL })).json()).toEqual([]);
  });

  it('answers 404 for an unknown game', async () => {
    const response = await app.inject({ url: '/api/games/nope/moves' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'not_found', message: 'Game nope not found' },
    });
  });

  it('answers from the database alone', async () => {
    await app.inject({ url: MOVES_URL });

    expect(gameRepository.mugloar.findAds).not.toHaveBeenCalled();
    expect(gameRepository.mugloar.findShopItems).not.toHaveBeenCalled();
    expect(gameRepository.mugloar.solveAd).not.toHaveBeenCalled();
    expect(gameRepository.mugloar.buyItem).not.toHaveBeenCalled();
  });
});
