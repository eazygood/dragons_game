import type { ApiErrorBody } from '@bigbank-dragon/contracts';
import type { FastifyReply } from 'fastify';

const HTTP_GONE = 410;

const GAME_OVER_BODY: ApiErrorBody = { error: { code: 'game_over', message: 'Game over' } };

// Game over reaches routes as a result, never an error, so this is its only HTTP mapping.
export const replyGameOver = ({ reply }: { reply: FastifyReply }) =>
  reply.status(HTTP_GONE).send(GAME_OVER_BODY);
