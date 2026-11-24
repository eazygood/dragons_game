import {
  BuyParamsSchema,
  GameParamsSchema,
  SolveParamsSchema,
  type BuyParams,
  type GameParams,
  type SolveParams,
} from '@bigbank-dragon/contracts';
import type { FastifyInstance } from 'fastify';

import { gameMediator } from '../mediators/index.ts';
import { replyGameOver } from './game-over-reply.ts';

const HTTP_CREATED = 201;

export const registerGameRoutes = (app: FastifyInstance) => {
  app.post('/games', async (_request, reply) =>
    reply.status(HTTP_CREATED).send(await gameMediator.startGame({ db: app.db })),
  );

  app.get<{ Params: GameParams }>(
    '/games/:gameId',
    { schema: { params: GameParamsSchema } },
    ({ params }) => gameMediator.findGame({ db: app.db, gameId: params.gameId }),
  );

  app.get<{ Params: GameParams }>(
    '/games/:gameId/turn',
    { schema: { params: GameParamsSchema } },
    async ({ params, log }, reply) => {
      const turn = await gameMediator.findTurn({ db: app.db, gameId: params.gameId, logger: log });

      return turn.status === 'game_over' ? replyGameOver({ reply }) : turn.value;
    },
  );

  app.post<{ Params: SolveParams }>(
    '/games/:gameId/ads/:adId/solve',
    { schema: { params: SolveParamsSchema } },
    async ({ params, log }, reply) => {
      const move = await gameMediator.solveAd({ db: app.db, ...params, logger: log });

      return move.status === 'game_over' ? replyGameOver({ reply }) : move.value;
    },
  );

  app.post<{ Params: BuyParams }>(
    '/games/:gameId/shop/:itemId/buy',
    { schema: { params: BuyParamsSchema } },
    async ({ params, log }, reply) => {
      const move = await gameMediator.buyItem({ db: app.db, ...params, logger: log });

      return move.status === 'game_over' ? replyGameOver({ reply }) : move.value;
    },
  );
};
