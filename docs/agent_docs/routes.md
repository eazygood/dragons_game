# Routes

## Organisation

```
api-prefix.ts             - the `/api` prefix, shared by routes/index.ts and web-app.ts
app-limits.ts             - `AppLimits`: bot cap, request timeout, body limit, rate limits

routes/
├── index.ts              - registration under /api, called from app.ts
├── game-routes.ts        - start, state, moves, turn, solve, buy
├── game-over-reply.ts    - the only 410 mapping
├── health-routes.ts      - readiness: 200, or 503 when the database does not answer
├── bot-routes.ts         - start a bot game
├── rate-limit-config.ts  - turns an `AppLimits` rate into a route's `config.rateLimit`
└── error-handlers/       - error-handler.ts, the single registered error handler

plugins/                  - registered by app.ts, in this order
├── mysql.ts              - decorates `app.db`; onClose destroys the pool
├── bot-games.ts          - decorates `app.botGames` (the registry); onClose stops games
├── security-headers.ts   - @fastify/helmet: CSP and the other headers
├── cross-site-guard.ts   - refuses a cross-site POST/PUT/PATCH/DELETE with 403
├── rate-limit.ts         - @fastify/rate-limit, opt-in per route
├── json-only-bodies.ts   - removes the text/plain parser
├── zod-validator.ts      - compiles contract schemas for route validation
└── web-app.ts            - @fastify/static for the SPA, and `notFoundHandler`
```

`app.ts` registers, in order: `mysql`, `bot-games`, `security-headers`,
`cross-site-guard`, `rate-limit`, `json-only-bodies`; then sets the zod
validator compiler, the error handler and `notFoundHandler`; then registers the
routes under `/api` and, last, `web-app`. Fastify's `frameworkErrors` also goes
to the error handler, so a request refused before routing (a malformed URL) gets
the same envelope.

Request schemas are the zod schemas in `packages/contracts`. There is no local
`schemas/` folder.

## Endpoints

All endpoints are under `/api`.

| Method | Path                              | 2xx              | Other                             |
| ------ | --------------------------------- | ---------------- | --------------------------------- |
| GET    | `/health`                         | 200 `{status}`   | 503 `{status}`                    |
| POST   | `/games`                          | 201 `GameView`   | 403, 413, 415, 429, 502           |
| POST   | `/bot-games`                      | 201 `GameView`   | 403, 413, 415, 429, 502, 503      |
| GET    | `/games/:gameId`                  | 200 `GameView`   | 400, 404 (database only), 429     |
| GET    | `/games/:gameId/moves`            | 200 `Move[]`     | 400, 404 (database only), 429     |
| GET    | `/games/:gameId/turn`             | 200 `TurnView`   | 400, 404, 409, 410, 429, 502      |
| POST   | `/games/:gameId/ads/:adId/solve`  | 200 `MoveResult` | 400, 403, 404, 409, 410, 429, 502 |
| POST   | `/games/:gameId/shop/:itemId/buy` | 200 `MoveResult` | 400, 403, 404, 409, 410, 429, 502 |

Every `POST` can also answer `413` (a body over `bodyLimitBytes`, 1 KiB) and
`415` (a non-JSON body); no route reads a body.

`GET /health` runs `select 1` through `healthMediator` and `healthManager`, so it
answers for the database, not just the process. A failed probe is `503
{ status: 'unavailable' }`, not the error envelope: the cause stays in the log and
a load balancer needs only the status code.

`400` is the schema layer: an id that fails the shape check never reaches a
manager or the upstream. Every route that takes a path parameter can answer it.
Both game-creating routes answer `502` when the upstream will not start a game.

`GET /games/:gameId` never answers 410: a finished game reports its final state
with `status: 'game_over'`. The client calls it after a 410 to render the end
screen.

`GET /games/:gameId/moves` reads the database only, so it answers for a finished
game and for a bot's game alike, and never calls the upstream. It returns the
moves **newest first**, by turn: every solve or buy advances the turn, so a turn
holds exactly one move. A move is a `solve` or a `buy`, each with the `rule` that
chose it; `rule` is `null` for rows written before the second migration (see
[`database.md`](database.md)). A game with no moves yet is `200 []`.

`POST /bot-games` starts a game and answers `201` as soon as the upstream game
exists. The bot then plays the rest **after the response**, inside the API
process, so the request returns in about one upstream round trip. The client
follows the game with `GET /games/:gameId` and `GET /games/:gameId/moves`. A bot
game is refused by `/turn`, `/solve` and `/buy` with `409 conflict`
(`GameNotPlayable`); `/moves` and `/games/:gameId` are open to anyone. The route
passes `app.log`, not `request.log`, because the game keeps logging after its
request has ended.

Bot games are capped (`AppLimits.maxBotGames`, 3). Each one makes an upstream call
every turn, and the upstream throttle is shared, so an uncapped route lets one client
starve every player. `startBotGame` reserves a slot **before** it asks the upstream
for a game, so concurrent requests cannot overshoot the cap; at the cap it throws
`TooManyRequestsError` (`429 too_many_requests`) with `Retry-After: 30`
(`BOT_SLOT_RETRY_AFTER_SECONDS`; a bot game takes a minute or two). Once shutdown has
begun the registry refuses every slot, and the route answers
`503 service_unavailable` instead, because waiting will not help. The slot is held
until the game settles, and released at once if starting it fails.

Shutdown closes games before the pool. `app.close()` runs `botGamesPlugin`'s
`onClose` first (it is registered after `mysqlPlugin`, and `onClose` hooks run
last-registered first): it aborts every game's `AbortSignal` and waits. A game
finishes the turn in flight, abandons its run and returns; only then is the pool
destroyed. `test/integration/bot-shutdown.test.ts` fails if the order is reversed.

A game the upstream has forgotten (games expire when left idle) makes `/turn`,
`/solve` and `/buy` answer `404 not_found`, because the upstream answers `404` for
it; the web app shows that as an expired game.

An unknown `/api/*` path answers `404 not_found` as JSON. Any other `GET` that no
route matches is answered with `index.html` when the web app is being served (see
_Serving the web app_).

One file per scope, each exporting a `register[Scope]Routes` function.
`routes/index.ts` registers them under `/api`; `app.ts` adds that to the plugins
and the two handlers and does nothing else.

Routes are **thin**: extract from the request, call a mediator, bind the
response. No game logic, no direct
repository or adapter access.

## Validation

Every route that takes input declares a schema. Invalid input is rejected at the
boundary before any outbound call is made — this is the brief's "input
validation" requirement and it is not optional.

Validate, at minimum:

- `gameId`, `adId`, `itemId` — shape and length, before they reach a URL.
- Any numeric body field — range, not just type.

Request and response types come from `packages/contracts`, so the React client
and the API cannot drift apart.

Route schemas are the contract's zod schemas, compiled by
`plugins/zod-validator.ts`. That compiler stands in for `fastify-type-provider-zod`,
because that package hard-requires `@fastify/swagger` and `openapi-types` and we
use neither. The compiler returns zod issues as Fastify validation errors, so the
error handler sees `error.validation` and answers `400 invalid_request`.

Routes read the pool as `app.db`, decorated by `plugins/mysql.ts`, and pass it
down as `{ db }`. The plugin's `onClose` hook destroys the pool.

**The server never trusts the client.** Client-side validation exists for user
experience; this layer exists for correctness. Neither substitutes for the other,
and removing the client's checks must never change what the API accepts. See
[`frontend.md`](frontend.md) for the other half.

## Errors

Errors are **typed domain values**, never strings, and never caught in routes.
They bubble to the one registered Fastify error handler, which owns the entire
HTTP mapping:

| Domain error          | HTTP  | Notes                                 |
| --------------------- | ----- | ------------------------------------- |
| `GameNotFound`        | `404` |                                       |
| `AdExpired`           | `409` | Board is stale; client should refetch |
| `InsufficientGold`    | `409` |                                       |
| `ShopItemNotFound`    | `404` |                                       |
| `GameNotPlayable`     | `409` | A bot's game; humans cannot move it   |
| _(schema validation)_ | `400` | Fastify's `error.validation`          |
| Fastify 4xx           | `4xx` | Malformed JSON; `413`, `415`          |
| `CrossSiteRequest`    | `403` | `invalid_request`; see _Hardening_    |
| `TooManyRequests`     | `429` | Rate limit, or the bot-game cap       |
| `UpstreamUnavailable` | `502` | Mugloar unreachable after retries     |
| `ServiceUnavailable`  | `503` | A bot game asked for during shutdown  |
| `PersistenceFailed`   | `500` | The player's state could not be saved |
| `DecisionInvariant`   | `500` | The engine named an ad or item absent |
| _(unmapped)_          | `500` | Logged; the message is never sent     |

**5xx messages are fixed.** A `4xx` sends the error's own message, which is
written for the client. A `5xx` `AppError` is logged at `warn` with its `cause`
(which can hold the upstream status and the start of its HTML body) and sends a
fixed text: `upstream_unavailable` → "The Mugloar server is unavailable",
`service_unavailable` → "The server is shutting down", anything else →
"Internal server error". An unmapped error is logged at `error` and answers
`500 internal`. Fastify's own 4xx errors (malformed JSON, `413`, `415`) map to
`invalid_request` with Fastify's message.

**`Retry-After`.** `@fastify/rate-limit` sets it on its own refusals. A `429`
raised by our code (the bot cap) carries `retryAfterSeconds`, and the handler
adds the header from it unless one is already set.

**Game over is not in this table.** The adapter returns `410` as a terminal
`{ status: 'game_over' }` result and never throws it, so it never reaches the
error handler. A route that receives that result calls `replyGameOver`, which
sends `410 { error: { code: 'game_over', message: 'Game over' } }`.

Every one of these has a designed treatment in the UI. Game over is a screen,
not a toast; an expired ad refreshes the board and says why.

Response bodies share one envelope so the client has a single error path.

## Hardening

All of it is registered in `app.ts`, ahead of the routes.

- **Rate limits** (`@fastify/rate-limit`, `plugins/rate-limit.ts`). Opt-in per route
  through `config.rateLimit`, never global, per client and per route:

  | `AppLimits` field | Routes                           | Limit        |
  | ----------------- | -------------------------------- | ------------ |
  | `startGameRate`   | `POST /games`, `POST /bot-games` | 10 a minute  |
  | `playMoveRate`    | solve, buy                       | 120 a minute |
  | `readTurnRate`    | `GET /games/:gameId/turn`        | 60 a minute  |
  | `pollRate`        | `GET /games/:gameId`, `/moves`   | 300 a minute |
  | _(none)_          | `GET /health`                    | unlimited    |

  `/turn` is metered like a move because it can fetch the board and shop
  upstream. The polled reads only touch the database; the web polls them at most
  once a second, so 300 leaves room for several tabs while still bounding a
  client that loops. The counters live in memory (see _Single-process
  assumptions_ in [`architecture.md`](architecture.md)). A refusal is
  `429 too_many_requests` with `Retry-After`. Clients are keyed by socket IP and
  `trustProxy` is off, so behind a proxy every client would share one bucket;
  compose binds to loopback, so none sits in front today.

- **Cross-site guard** (`plugins/cross-site-guard.ts`). An `onRequest` hook refuses a
  `POST`, `PUT`, `PATCH` or `DELETE` with `403` when `Sec-Fetch-Site` is
  `cross-site`, or when an `Origin` header names a host other than the request's
  `Host`. CORS does not stop a page on another site from sending such a request
  through a visitor's browser; it only hides the response. Browsers always send
  one of the two headers on a cross-site write, while curl, the CLIs and the tests
  send neither, so they pass. It reuses `invalid_request` because a new code would
  break the web's exhaustive error-copy map, and only a browser can trigger it.
- **Body limit.** `bodyLimit` is 1 KiB (`bodyLimitBytes`): no route needs a body,
  so a flood is refused with `413` before it is buffered or parsed.
- **Request timeout.** `requestTimeout` is 15s: the longest a client may take to send a
  request, which cuts off a connection that trickles its headers. It does not limit a
  handler; the upstream's own 10s timeout does that.
- **Security headers** (`@fastify/helmet`, `plugins/security-headers.ts`). The CSP
  allows only the app's own origin: the built `index.html` has no inline script or
  style. There is no HSTS and no `upgrade-insecure-requests`, because the app is
  served over plain http and TLS would end at a proxy that owns those headers.
- **JSON bodies only.** `plugins/json-only-bodies.ts` removes Fastify's `text/plain`
  parser. A cross-site `<form enctype="text/plain">` needs no preflight, so JSON,
  which does, is the only body type a route can read; `text/plain` answers `415`.
  The web client sends no body on its POSTs. A bodiless cross-site
  `fetch(..., { mode: 'no-cors' })` from a browser is refused by the cross-site
  guard; the rate limit and the bot cap bound a client that is not a browser.

`AppLimits` (`app-limits.ts`) holds every default, and `buildApp({ limits })` takes
an override, which is how the tests use a tight limit.

## Calling upstream

Routes never call `dragonsofmugloar.com`. Only `mugloar-api-adapter` does, and it
owns:

- timeouts and a bounded retry with backoff on 5xx and network failure
- **never retrying `solve` or `buy`** — they are not idempotent
- tolerating **HTML bodies** on non-2xx responses
- translating `410` into the `GameOver` domain state instead of throwing
- the shared process-wide outbound throttle
- a 256 KiB cap on every response body it reads

See [`architecture.md`](architecture.md) for the verified upstream contract.

## Serving the web app

When `WEB_DIST_DIR` is set, `plugins/web-app.ts` registers `@fastify/static` for
the built React app, and its `notFoundHandler` (set in `app.ts`) answers any
unmatched non-`/api` `GET` with `index.html` so client-side routes survive a
reload. A request for a missing asset therefore gets `200 text/html`, not a 404
(a known limit). `/api/*` misses keep the JSON envelope; the match is on the
`/api` prefix followed by `/`, `?` or the end, so `/apiary` is an app route.

- **Caching.** Files under `assets/` are named by content hash, so they are served
  `public, max-age=31536000, immutable`. Everything else, `index.html` included,
  is `no-cache`, so a new deploy is picked up on the next load.
- **Dotfiles are denied**, so a stray `.env` in the build output is never served. `WEB_DIST_DIR` is unset in development, where Vite serves
  the app and proxies `/api`. `compose.yaml` sets it for the `app` service.

## Running in Docker

The `Dockerfile` has four stages: a shared `base`, production dependencies, the web build (on top of
them, so the two installs never run side by side on a small VM), and a `node:26-slim`
runtime that runs as `node`, not root. The runtime has no pnpm and no tsx: Node strips
the types from `apps/api/src` itself, which is why the API uses only erasable
TypeScript syntax (no enums or parameter properties). `compose.yaml` runs
`node apps/api/src/migrate.ts` and then `exec node apps/api/src/server.ts`, publishes
the port on `127.0.0.1` only, and gives a stopping container 30s, enough for a bot
turn in flight (one 10s upstream timeout) to finish before the pool closes.

## No streaming

There is no SSE or WebSocket. `/watch` polls `GET /games/:gameId` once a second,
and `/moves` every 2.5 seconds when the move log is open, while the game is
`active`. A bot game's
progress is just rows in the database, so a viewer can come and go, reload, or
open the same game twice without touching the run. See
[`frontend.md`](frontend.md) for the polling rule.
