import type { z } from 'zod';

import { loadConfig } from '../../config/index.ts';
import type { AppConfig } from '../../config/index.ts';
import {
  AdExpiredError,
  GameNotFoundError,
  UpstreamUnavailableError,
} from '../../errors/errors.ts';
import { mugloarThrottle } from './throttle.ts';

const GAME_OVER_STATUS = 410;
const NOT_FOUND_STATUS = 404;
const BAD_REQUEST_STATUS = 400;
const SERVER_ERROR_STATUS = 500;
// Writes are never retried: solve and buy are not idempotent, and a retried
// start whose first response was lost would silently open a second game.
const NO_RETRIES = 0;

export type UpstreamResult<T> = { status: 'ok'; value: T } | { status: 'game_over' };

type Method = 'GET' | 'POST';

type RequestOptions<T> = {
  operation: string;
  method: Method;
  path: string;
  schema: z.ZodType<T>;
};

type Attempt = { kind: 'response'; response: Response } | { kind: 'unreachable'; error: unknown };

const isRetryable = (attempt: Attempt) =>
  attempt.kind === 'unreachable' || attempt.response.status >= SERVER_ERROR_STATUS;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Error bodies are HTML (spec §3.6), so a non-2xx body is read as text and only quoted.
const failureFor = async ({ response, label }: { response: Response; label: string }) => {
  const body = await response.text().catch(() => '');
  const message = `${label} → ${response.status}: ${body.slice(0, 120)}`;

  if (response.status === NOT_FOUND_STATUS) {
    return new GameNotFoundError({ message });
  }

  if (response.status === BAD_REQUEST_STATUS) {
    return new AdExpiredError({ message });
  }

  return new UpstreamUnavailableError({ message });
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
  } catch (cause) {
    throw new UpstreamUnavailableError({ message: `${label} returned an unexpected body`, cause });
  }
};

const retriesFor = ({ method, config }: { method: Method; config: AppConfig }) =>
  method === 'GET' ? config.mugloarReadRetries : NO_RETRIES;

const send = async ({
  config,
  method,
  path,
}: {
  config: AppConfig;
  method: Method;
  path: string;
}): Promise<Attempt> => {
  await mugloarThrottle.acquire();

  try {
    const response = await fetch(`${config.mugloarBaseUrl}${path}`, {
      method,
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(config.mugloarTimeoutMs),
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
}: RequestOptions<T>): Promise<UpstreamResult<T>> => {
  const config = loadConfig({ env: process.env });
  const label = `${operation} (${method} ${path})`;
  const retries = retriesFor({ method, config });
  let attempt = await send({ config, method, path });

  for (let retry = 0; retry < retries && isRetryable(attempt); retry += 1) {
    await delay(config.mugloarRetryBaseDelayMs * 2 ** retry);
    attempt = await send({ config, method, path });
  }

  if (attempt.kind === 'unreachable') {
    throw new UpstreamUnavailableError({ message: `${label} unreachable`, cause: attempt.error });
  }

  const { response } = attempt;

  if (response.status === GAME_OVER_STATUS) {
    await response.body?.cancel();

    return { status: 'game_over' };
  }

  if (!response.ok) {
    throw await failureFor({ response, label });
  }

  return { status: 'ok', value: await parseBody({ response, schema, label }) };
};
