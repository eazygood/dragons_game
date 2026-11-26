import { ApiErrorBodySchema } from '@bigbank-dragon/contracts';
import type { z } from 'zod';

import { ApiError, UNREACHABLE_STATUS } from './api-error.ts';
import type { ClientErrorCode } from './api-error.ts';

const TOO_MANY_REQUESTS_STATUS = 429;

// A proxy answers with HTML, so these statuses are mapped without an envelope to read.
const CODE_BY_STATUS = new Map<number, ClientErrorCode>([
  [TOO_MANY_REQUESTS_STATUS, 'too_many_requests'],
  [502, 'upstream_unavailable'],
  [503, 'upstream_unavailable'],
  [504, 'upstream_unavailable'],
]);

// Covers a solve or buy that hangs: without it the buttons would stay disabled forever.
const REQUEST_TIMEOUT_MS = 20_000;

// A cancelled query is not a failure, so Query must see the abort itself.
const toTransportError = ({
  cause,
  signal,
}: {
  cause: unknown;
  signal: AbortSignal | undefined;
}) => {
  if (signal?.aborted) {
    return cause;
  }

  const message = cause instanceof Error ? cause.message : 'Network error';

  return new ApiError({ status: UNREACHABLE_STATUS, code: 'unreachable', message });
};

// Only a body that is not JSON is unreadable; one that never fully arrives is a transport failure.
const readJson = async ({
  response,
  signal,
}: {
  response: Response;
  signal: AbortSignal | undefined;
}): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch (cause) {
    if (cause instanceof SyntaxError) {
      return undefined;
    }

    throw toTransportError({ cause, signal });
  }
};

// The error body may be a proxy's HTML page, so the envelope is parsed, never assumed.
const toApiError = async ({
  response,
  signal,
}: {
  response: Response;
  signal: AbortSignal | undefined;
}) => {
  const envelope = ApiErrorBodySchema.safeParse(await readJson({ response, signal }));

  if (envelope.success) {
    return new ApiError({ status: response.status, ...envelope.data.error });
  }

  const code = CODE_BY_STATUS.get(response.status) ?? 'internal';

  return new ApiError({ status: response.status, code, message: response.statusText });
};

// AbortSignal.any and AbortSignal.timeout are not used: the former needs Chrome 116,
// Firefox 124 or Safari 17.4, and a bundler target does not polyfill APIs.
const createRequestSignal = ({ signal }: { signal: AbortSignal | undefined }) => {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal?.reason);
  const timer = setTimeout(() => {
    controller.abort(new DOMException('The request timed out', 'TimeoutError'));
  }, REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    forwardAbort();
  } else {
    signal?.addEventListener('abort', forwardAbort, { once: true });
  }

  const dispose = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  };

  return { signal: controller.signal, dispose };
};

const sendRequest = async ({
  path,
  method,
  signal,
  requestSignal,
}: {
  path: string;
  method: string;
  signal: AbortSignal | undefined;
  requestSignal: AbortSignal;
}) => {
  try {
    return await fetch(path, {
      method,
      headers: { accept: 'application/json' },
      signal: requestSignal,
    });
  } catch (cause) {
    throw toTransportError({ cause, signal });
  }
};

type RequestOptions<T> = {
  path: string;
  method?: 'GET' | 'POST';
  schema: z.ZodType<T>;
  signal?: AbortSignal;
};

const exchange = async <T>({
  path,
  method = 'GET',
  schema,
  signal,
  requestSignal,
}: RequestOptions<T> & { requestSignal: AbortSignal }): Promise<T> => {
  const response = await sendRequest({ path, method, signal, requestSignal });

  if (!response.ok) {
    throw await toApiError({ response, signal });
  }

  const parsed = schema.safeParse(await readJson({ response, signal }));

  if (!parsed.success) {
    console.error('Response broke its contract', { path, issues: parsed.error.issues });
    throw new ApiError({
      status: response.status,
      code: 'invalid_response',
      message: 'Unexpected response from the server',
    });
  }

  return parsed.data;
};

// No request carries a body, so no content-type is sent: Fastify rejects an empty JSON body.
// The timeout stays armed until the body is read, because a stalled body hangs like a stalled fetch.
export const apiRequest = async <T>(options: RequestOptions<T>): Promise<T> => {
  const request = createRequestSignal({ signal: options.signal });

  try {
    return await exchange({ ...options, requestSignal: request.signal });
  } finally {
    request.dispose();
  }
};
