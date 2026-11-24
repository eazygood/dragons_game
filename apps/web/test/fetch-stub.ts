import { vi } from 'vitest';

type Responder = () => Response | Promise<Response>;

export type StubbedRoutes = Record<string, Responder>;

export const jsonResponse = ({ status, body }: { status: number; body: unknown }) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const respondWith =
  ({ status, body }: { status: number; body: unknown }): Responder =>
  () =>
    jsonResponse({ status, body });

export const respondOk = ({ body }: { body: unknown }) => respondWith({ status: 200, body });

export const respondNever = (): Responder => () => new Promise<Response>(() => undefined);

// Each call takes the next responder; the last one repeats once the list runs out.
export const respondInSequence = ({ responders }: { responders: Responder[] }): Responder => {
  let callCount = 0;

  return () => {
    const responder = responders[Math.min(callCount, responders.length - 1)];

    callCount += 1;

    if (!responder) {
      throw new Error('respondInSequence needs at least one responder');
    }

    return responder();
  };
};

// Keys are 'METHOD /path'; an unstubbed request fails the test loudly instead of hanging.
export const stubApi = (routes: StubbedRoutes) => {
  const requestKey = (path: string, init?: RequestInit) => `${init?.method ?? 'GET'} ${path}`;

  const fetchStub = vi.fn((path: string, init?: RequestInit) => {
    const key = requestKey(path, init);
    const respond = routes[key];

    if (!respond) {
      return Promise.reject(new Error(`Unstubbed request: ${key}`));
    }

    return Promise.resolve(respond());
  });

  vi.stubGlobal('fetch', fetchStub);

  const callCountOf = (key: string) =>
    fetchStub.mock.calls.filter(([path, init]) => requestKey(path, init) === key).length;

  return Object.assign(fetchStub, { callCountOf });
};
