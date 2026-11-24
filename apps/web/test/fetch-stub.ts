import { vi } from 'vitest';

export type StubbedRoutes = Record<string, () => Response>;

export const jsonResponse = ({ status, body }: { status: number; body: unknown }) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Keys are 'METHOD /path'; an unstubbed request fails the test loudly instead of hanging.
export const stubApi = (routes: StubbedRoutes) => {
  const fetchStub = vi.fn((path: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${path}`;
    const respond = routes[key];

    if (!respond) {
      return Promise.reject(new Error(`Unstubbed request: ${key}`));
    }

    return Promise.resolve(respond());
  });

  vi.stubGlobal('fetch', fetchStub);

  return fetchStub;
};
