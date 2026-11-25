import type { z } from 'zod';

import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { AppError } from '../../errors/app-error.ts';
import { GameNotFoundError, UpstreamUnavailableError } from '../../errors/errors.ts';
import { mugloarApiRuntime, mugloarThrottle } from './adapter-config.ts';
import type { MugloarApiConfig } from './adapter-config.ts';

const GAME_OVER_STATUS = 410;
const NOT_FOUND_STATUS = 404;
const BAD_REQUEST_STATUS = 400;
const SERVER_ERROR_STATUS = 500;
const ERROR_BODY_EXCERPT_LENGTH = 120;
// Writes are never retried: solve and buy are not idempotent, and a retried
// start whose first response was lost would silently open a second game.
const NO_RETRIES = 0;
// Client-facing text: the upstream path, status and HTML body go into `cause`, for the log only.
const UPSTREAM_UNAVAILABLE_MESSAGE = 'The Mugloar server is unavailable';
const UPSTREAM_GAME_NOT_FOUND_MESSAGE = 'The Mugloar server does not know this game';

type Method = 'GET' | 'POST';

export type BadRequestError = ({ cause }: { cause: Error }) => AppError;

type RequestOptions<T> = {
  operation: string;
  method: Method;
  path: string;
  schema: z.ZodType<T>;
  // Only the endpoint knows what a 400 means; without this it is an upstream failure.
  badRequestError?: BadRequestError;
};

type Attempt = { kind: 'response'; response: Response } | { kind: 'unreachable'; error: unknown };

const isRetryable = (attempt: Attempt) =>
  attempt.kind === 'unreachable' || attempt.response.status >= SERVER_ERROR_STATUS;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const unavailable = ({ cause }: { cause: Error }) =>
  new UpstreamUnavailableError({ message: UPSTREAM_UNAVAILABLE_MESSAGE, cause });

// Error bodies are HTML, not JSON, so a non-2xx body is read as text and only quoted.
const failureFor = async ({
  response,
  label,
  badRequestError,
}: {
  response: Response;
  label: string;
  badRequestError?: BadRequestError;
}) => {
  const responseText = await response.text().catch(() => '');
  const cause = new Error(
    `${label} → ${response.status}: ${responseText.slice(0, ERROR_BODY_EXCERPT_LENGTH)}`,
  );

  if (response.status === NOT_FOUND_STATUS) {
    return new GameNotFoundError({ message: UPSTREAM_GAME_NOT_FOUND_MESSAGE, cause });
  }

  if (response.status === BAD_REQUEST_STATUS && badRequestError) {
    return badRequestError({ cause });
  }

  return unavailable({ cause });
};

const parseBody = async <T>({
  response,
  schema,
  label,
}: {
  response: Response;
  schema: z.ZodType<T>;
  label: string;
}): Promise<T> => {
  try {
    return schema.parse(JSON.parse(await response.text()));
  } catch (parseError) {
    throw unavailable({
      cause: new Error(`${label} returned an unexpected body`, { cause: parseError }),
    });
  }
};

const retriesFor = ({ method, config }: { method: Method; config: MugloarApiConfig }) =>
  method === 'GET' ? config.mugloarReadRetries : NO_RETRIES;

const send = async ({
  config,
  method,
  path,
}: {
  config: MugloarApiConfig;
  method: Method;
  path: string;
}): Promise<Attempt> => {
  // One budget covers the wait for a token and the request, so a starved caller still fails.
  const signal = AbortSignal.timeout(config.mugloarTimeoutMs);

  try {
    await mugloarThrottle.acquire({ signal });

    const response = await fetch(`${config.mugloarBaseUrl}${path}`, {
      method,
      headers: { accept: 'application/json' },
      signal,
    });

    return { kind: 'response', response };
  } catch (error) {
    return { kind: 'unreachable', error };
  }
};

export const request = async <T>({
  operation,
  method,
  path,
  schema,
  badRequestError,
}: RequestOptions<T>): Promise<OrGameOver<T>> => {
  const { config } = mugloarApiRuntime();
  const label = `${operation} (${method} ${path})`;
  const retries = retriesFor({ method, config });
  let attempt = await send({ config, method, path });

  for (let retry = 0; retry < retries && isRetryable(attempt); retry += 1) {
    await delay(config.mugloarRetryBaseDelayMs * 2 ** retry);
    attempt = await send({ config, method, path });
  }

  if (attempt.kind === 'unreachable') {
    throw unavailable({ cause: new Error(`${label} unreachable`, { cause: attempt.error }) });
  }

  const { response } = attempt;

  if (response.status === GAME_OVER_STATUS) {
    await response.body?.cancel();

    return { status: 'game_over' };
  }

  if (!response.ok) {
    throw await failureFor({ response, label, badRequestError });
  }

  return { status: 'ok', value: await parseBody({ response, schema, label }) };
};
