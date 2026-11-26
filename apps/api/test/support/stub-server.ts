import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

type StubRequest = { path: string };
type Handler = (request: StubRequest) => unknown;
type Route = { method: string; pattern: string; matcher: RegExp; handler: Handler };

export type StubServer = {
  baseUrl: string;
  get(pattern: string, handler: Handler): void;
  post(pattern: string, handler: Handler): void;
  failTimes(pattern: string, times: number, status: number): { then(handler: Handler): void };
  callCount(pattern: string): number;
  reset(): void;
  close(): Promise<void>;
};

const toMatcher = (pattern: string) => new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, '[^/]+')}$`);

// A handler returns a JSON body (status 200), or [status, body, headers?] where a string body is HTML.
const isStatusTuple = (reply: unknown): reply is [number, unknown, Record<string, string>?] =>
  Array.isArray(reply) && typeof reply[0] === 'number';

const send = (response: ServerResponse, reply: unknown) => {
  const [status, body, headers = {}] = isStatusTuple(reply) ? reply : [200, reply];
  const isHtml = typeof body === 'string';

  response.writeHead(status, {
    'content-type': isHtml ? 'text/html' : 'application/json',
    ...headers,
  });
  response.end(isHtml ? body : JSON.stringify(body));
};

export const sleepForever = () => new Promise<never>(() => undefined);

export const startStubServer = async (): Promise<StubServer> => {
  let routes: Route[] = [];
  const calls = new Map<string, number>();

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const route = routes.find(
      (candidate) =>
        candidate.method === request.method && candidate.matcher.test(request.url ?? ''),
    );

    if (!route) {
      send(response, [599, '<html>no stub route</html>']);

      return;
    }

    calls.set(route.pattern, (calls.get(route.pattern) ?? 0) + 1);
    send(response, await route.handler({ path: request.url ?? '' }));
  };

  const server: Server = createServer((request, response) => void handle(request, response));

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;
  const register = (method: string) => (pattern: string, handler: Handler) => {
    routes = [{ method, pattern, matcher: toMatcher(pattern), handler }, ...routes];
  };

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    get: register('GET'),
    post: register('POST'),
    failTimes: (pattern, times, status) => ({
      then: (handler) => {
        let failures = 0;

        register('GET')(pattern, (request) => {
          failures += 1;

          return failures <= times ? [status, '<html>upstream error</html>'] : handler(request);
        });
      },
    }),
    callCount: (pattern) => calls.get(pattern) ?? 0,
    reset: () => {
      routes = [];
      calls.clear();
    },
    close: () => {
      server.closeAllConnections();

      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
};
