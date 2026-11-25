import { request } from './request.ts';

export { mugloarThrottle } from './throttle.ts';

// A plain object rather than bare exports, so tests can vi.spyOn(mugloarApiAdapter, 'request').
export const mugloarApiAdapter = { request };
