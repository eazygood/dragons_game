import { request } from './request.ts';

export { createTokenBucket, mugloarThrottle } from './throttle.ts';
export type { Throttle } from './throttle.ts';

// A plain object rather than bare exports, so tests can vi.spyOn(mugloarApiAdapter, 'request').
export const mugloarApiAdapter = { request };
