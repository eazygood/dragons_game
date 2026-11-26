import { QueryClient } from '@tanstack/react-query';

import { ApiError, isApiError } from './api/api-error.ts';

const MAX_READ_RETRIES = 2;
const FIRST_SERVER_ERROR_STATUS = 500;

const isTransient = (error: unknown) =>
  isApiError({ error, code: 'unreachable' }) ||
  (error instanceof ApiError && error.status >= FIRST_SERVER_ERROR_STATUS);

const shouldRetryRead = ({ failureCount, error }: { failureCount: number; error: unknown }) =>
  failureCount < MAX_READ_RETRIES && isTransient(error);

// Query's default pauses while navigator.onLine is false, which shows "Loading" forever and
// replays a queued solve or buy on reconnect. 'always' fetches and reports `unreachable`.
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        retry: (failureCount, error) => shouldRetryRead({ failureCount, error }),
      },
      mutations: { networkMode: 'always', retry: false },
    },
  });
