import { setTimeout as setTimeoutPromise } from 'node:timers/promises';

import type { z } from 'zod';

import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { AppError } from '../../errors/app-error.ts';
import { GameNotFoundError, UpstreamUnavailableError } from '../../errors/errors.ts';
import { mugloarApiRuntime } from './adapter-config.ts';
import type { MugloarApiRuntime } from './adapter-config.ts';
import { discardBody, readBoundedText } from './response-body.ts';

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

type BadRequestError = ({ cause }: { cause: Error }) => AppError;

type RequestOptions<T> = {
  operation: string;
  method: Method;
  path: string;
  schema: z.ZodType<T>;
  // Only the endpoint knows what a 400 means; without this it is an upstream failure.
  badRequestError?: BadRequestError;
  // Ends the throttle wait, the call and the retry backoff early; every attempt also has its own timeout.
  signal?: AbortSignal;
};

type SendOutcome =
  { kind: 'response'; response: Response } | { kind: 'unreachable'; error: unknown };

const isRetryable = (outcome: SendOutcome) =>
  outcome.kind === 'unreachable' || outcome.response.status >= SERVER_ERROR_STATUS;

const sleep = ({ ms, signal }: { ms: number; signal?: AbortSignal }) =>
  setTimeoutPromise(ms, undefined, { signal });

const upstreamUnavailable = ({ cause }: { cause: Error }) =>
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
  const responseText = await readBoundedText({ response }).catch(() => '');
  const cause = new Error(
    `${label} → ${response.status}: ${responseText.slice(0, ERROR_BODY_EXCERPT_LENGTH)}`,
  );

  if (response.status === NOT_FOUND_STATUS) {
    return new GameNotFoundError({ message: UPSTREAM_GAME_NOT_FOUND_MESSAGE, cause });
  }

  if (response.status === BAD_REQUEST_STATUS && badRequestError) {
    return badRequestError({ cause });
  }

  return upstreamUnavailable({ cause });
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
    return schema.parse(JSON.parse(await readBoundedText({ response })));
  } catch (parseError) {
    throw upstreamUnavailable({
      cause: new Error(`${label} returned an unexpected body`, { cause: parseError }),
    });
  }
};

const retriesFor = ({ method, runtime }: { method: Method; runtime: MugloarApiRuntime }) =>
  method === 'GET' ? runtime.config.mugloarReadRetries : NO_RETRIES;

const sendOnce = async ({
  runtime,
  method,
  path,
  signal,
}: {
  runtime: MugloarApiRuntime;
  method: Method;
  path: string;
  signal?: AbortSignal;
}): Promise<SendOutcome> => {
  const { config, throttle } = runtime;
  // One budget covers the wait for a token and the request, so a starved caller still fails.
  const timeout = AbortSignal.timeout(config.mugloarTimeoutMs);
  const attemptSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    await throttle.acquire({ signal: attemptSignal });

    // A redirect would send the request, or follow it, to a host we never configured.
    const response = await fetch(`${config.mugloarBaseUrl}${path}`, {
      method,
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: attemptSignal,
    });

    return { kind: 'response', response };
  } catch (error) {
    return { kind: 'unreachable', error };
  }
};

const backOff = async ({
  ms,
  signal,
  label,
}: {
  ms: number;
  signal?: AbortSignal;
  label: string;
}) => {
  try {
    await sleep({ ms, signal });
  } catch (abortError) {
    throw upstreamUnavailable({
      cause: new Error(`${label} aborted while backing off`, { cause: abortError }),
    });
  }
};

export const request = async <T>({
  operation,
  method,
  path,
  schema,
  badRequestError,
  signal,
}: RequestOptions<T>): Promise<OrGameOver<T>> => {
  const runtime = mugloarApiRuntime();
  const label = `${operation} (${method} ${path})`;
  const retries = retriesFor({ method, runtime });
  let lastOutcome = await sendOnce({ runtime, method, path, signal });

  for (let retry = 0; retry < retries && isRetryable(lastOutcome); retry += 1) {
    if (lastOutcome.kind === 'response') {
      await discardBody({ response: lastOutcome.response });
    }

    await backOff({ ms: runtime.config.mugloarRetryBaseDelayMs * 2 ** retry, signal, label });
    lastOutcome = await sendOnce({ runtime, method, path, signal });
  }

  if (lastOutcome.kind === 'unreachable') {
    throw upstreamUnavailable({
      cause: new Error(`${label} unreachable`, { cause: lastOutcome.error }),
    });
  }

  const { response } = lastOutcome;

  if (response.status === GAME_OVER_STATUS) {
    await discardBody({ response });

    return { status: 'game_over' };
  }

  if (!response.ok) {
    throw await failureFor({ response, label, badRequestError });
  }

  return { status: 'ok', value: await parseBody({ response, schema, label }) };
};
