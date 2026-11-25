import type { ApiErrorBody, ApiErrorCode } from '@bigbank-dragon/contracts';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../../errors/app-error.ts';

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const INTERNAL_ERROR_MESSAGE = 'Internal server error';
// A 5xx answers with fixed text per code; what went wrong is in the error's cause, logged.
const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  upstream_unavailable: 'The Mugloar server is unavailable',
};

const isClientError = (statusCode: number | undefined): statusCode is number =>
  statusCode !== undefined &&
  statusCode >= HTTP_BAD_REQUEST &&
  statusCode < HTTP_INTERNAL_SERVER_ERROR;

const errorBody = ({ code, message }: ApiErrorBody['error']): ApiErrorBody => ({
  error: { code, message },
});

export const errorHandler = (
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof AppError && error.statusCode < HTTP_INTERNAL_SERVER_ERROR) {
    return reply.status(error.statusCode).send(errorBody(error));
  }

  if (error instanceof AppError) {
    request.log.warn({ err: error }, 'request failed');

    const message = SERVER_ERROR_MESSAGES[error.code] ?? INTERNAL_ERROR_MESSAGE;

    return reply.status(error.statusCode).send(errorBody({ code: error.code, message }));
  }

  if (error.validation) {
    const message = error.validation[0]?.message ?? 'Invalid request';

    return reply.status(HTTP_BAD_REQUEST).send(errorBody({ code: 'invalid_request', message }));
  }

  // Fastify's own refusals (malformed JSON, wrong content type) are the client's fault.
  if (isClientError(error.statusCode)) {
    return reply
      .status(error.statusCode)
      .send(errorBody({ code: 'invalid_request', message: error.message }));
  }

  // The original message can carry connection strings or upstream HTML; log it, never send it.
  request.log.error({ err: error }, 'request failed');

  return reply
    .status(HTTP_INTERNAL_SERVER_ERROR)
    .send(errorBody({ code: 'internal', message: INTERNAL_ERROR_MESSAGE }));
};
