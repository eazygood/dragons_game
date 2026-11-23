import type { z } from 'zod';

import type { AppConfig } from '../../config/index.ts';
import {
  AdExpiredError,
  GameNotFoundError,
  UpstreamUnavailableError,
} from '../../errors/errors.ts';

const GAME_OVER_STATUS = 410;
const NOT_FOUND_STATUS = 404;
const BAD_REQUEST_STATUS = 400;
const SERVER_ERROR_STATUS = 500;

export type Throttle = { acquire(): Promise<void> };

export type UpstreamResult<T> = { status: 'ok'; value: T } | { status: 'game_over' };

type Method = 'GET' | 'POST';

type RequestOptions<T> = { method: Method; path: string; retries: number; schema: z.ZodType<T> };

type Attempt = { kind: 'response'; response: Response } | { kind: 'unreachable'; error: unknown };

export type Request = <T>(options: RequestOptions<T>) => Promise<UpstreamResult<T>>;

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

export const createRequest = ({
  config,
  fetchImpl,
  throttle,
}: {
  config: AppConfig;
  fetchImpl: typeof fetch;
  throttle: Throttle;
}): Request => {
  const send = async ({ method, path }: { method: Method; path: string }): Promise<Attempt> => {
    await throttle.acquire();

    try {
      const response = await fetchImpl(`${config.mugloarBaseUrl}${path}`, {
        method,
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(config.mugloarTimeoutMs),
      });

      return { kind: 'response', response };
    } catch (error) {
      return { kind: 'unreachable', error };
    }
  };

  return async <T>({ method, path, retries, schema }: RequestOptions<T>) => {
    const label = `${method} ${path}`;
    let attempt = await send({ method, path });

    for (let retry = 0; retry < retries && isRetryable(attempt); retry += 1) {
      await delay(config.mugloarRetryBaseDelayMs * 2 ** retry);
      attempt = await send({ method, path });
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
};
