import { ApiErrorBodySchema } from '@bigbank-dragon/contracts';
import type { z } from 'zod';

import { ApiError, UNREACHABLE_STATUS } from './api-error.ts';

const UPSTREAM_DOWN_STATUSES = new Set([502, 503, 504]);

const readJson = async ({ response }: { response: Response }): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
};

// The error body may be a proxy's HTML page, so the envelope is parsed, never assumed.
const toApiError = async ({ response }: { response: Response }) => {
  const envelope = ApiErrorBodySchema.safeParse(await readJson({ response }));

  if (envelope.success) {
    return new ApiError({ status: response.status, ...envelope.data.error });
  }

  const code = UPSTREAM_DOWN_STATUSES.has(response.status) ? 'upstream_unavailable' : 'internal';

  return new ApiError({ status: response.status, code, message: response.statusText });
};

const sendRequest = async ({ path, method }: { path: string; method: string }) => {
  try {
    return await fetch(path, { method, headers: { accept: 'application/json' } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Network error';

    throw new ApiError({ status: UNREACHABLE_STATUS, code: 'unreachable', message });
  }
};

// No request carries a body, so no content-type is sent: Fastify rejects an empty JSON body.
export const apiRequest = async <T>({
  path,
  method = 'GET',
  schema,
}: {
  path: string;
  method?: 'GET' | 'POST';
  schema: z.ZodType<T>;
}): Promise<T> => {
  const response = await sendRequest({ path, method });

  if (!response.ok) {
    throw await toApiError({ response });
  }

  const parsed = schema.safeParse(await readJson({ response }));

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
