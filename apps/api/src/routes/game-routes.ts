import {
  BuyParamsSchema,
  GameParamsSchema,
  SolveParamsSchema,
  type BuyParams,
  type GameParams,
  type SolveParams,
} from '@bigbank-dragon/contracts';
import type { FastifyInstance } from 'fastify';

import type { AppLimits } from '../app-limits.ts';
import { gameMediator } from '../mediators/index.ts';
import { replyGameOver } from './game-over-reply.ts';
import { rateLimitConfig } from './rate-limit-config.ts';

const HTTP_CREATED = 201;

export const registerGameRoutes = (app: FastifyInstance, { limits }: { limits: AppLimits }) => {
  const startGameConfig = rateLimitConfig({ rate: limits.startGameRate });
  const playMoveConfig = rateLimitConfig({ rate: limits.playMoveRate });

  app.post('/games', { config: startGameConfig }, async (_request, reply) =>
    reply.status(HTTP_CREATED).send(await gameMediator.startGame({ db: app.db })),
  );

  app.get<{ Params: GameParams }>(
    '/games/:gameId',
    { schema: { params: GameParamsSchema } },
    ({ params }) => gameMediator.findGame({ db: app.db, gameId: params.gameId }),
  );

  app.get<{ Params: GameParams }>(
    '/games/:gameId/moves',
    { schema: { params: GameParamsSchema } },
    ({ params }) => gameMediator.findMoves({ db: app.db, gameId: params.gameId }),
  );

  app.get<{ Params: GameParams }>(
    '/games/:gameId/turn',
    { schema: { params: GameParamsSchema } },
    async ({ params, log }, reply) => {
      const turnViewResult = await gameMediator.findTurn({
        db: app.db,
        gameId: params.gameId,
        logger: log,
      });

      return turnViewResult.status === 'game_over'
        ? replyGameOver({ reply })
        : turnViewResult.value;
    },
  );

  app.post<{ Params: SolveParams }>(
    '/games/:gameId/ads/:adId/solve',
    { schema: { params: SolveParamsSchema }, config: playMoveConfig },
    async ({ params, log }, reply) => {
      const moveResult = await gameMediator.solveAd({ db: app.db, ...params, logger: log });

      return moveResult.status === 'game_over' ? replyGameOver({ reply }) : moveResult.value;
    },
  );

  app.post<{ Params: BuyParams }>(
    '/games/:gameId/shop/:itemId/buy',
    { schema: { params: BuyParamsSchema }, config: playMoveConfig },
    async ({ params, log }, reply) => {
      const moveResult = await gameMediator.buyItem({ db: app.db, ...params, logger: log });

      return moveResult.status === 'game_over' ? replyGameOver({ reply }) : moveResult.value;
    },
  );
};
