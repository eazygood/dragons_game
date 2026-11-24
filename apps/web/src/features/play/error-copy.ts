import { isApiError } from '../../api/api-error.ts';
import { copy } from './copy.ts';

export const isUpstreamDown = ({ error }: { error: unknown }) =>
  isApiError({ error, code: 'upstream_unavailable' }) || isApiError({ error, code: 'unreachable' });

export const errorCopy = ({ error }: { error: unknown }) =>
  isUpstreamDown({ error }) ? copy.errors.upstreamUnavailable : copy.errors.unexpected;
