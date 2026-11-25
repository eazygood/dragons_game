# Routes

## Organisation

```
routes/
├── index.ts              - registration under /api, called from app.ts
├── game-routes.ts        - start, state, moves, turn, solve, buy
├── game-over-reply.ts    - the only 410 mapping
├── health-routes.ts      - liveness
├── bot-routes.ts         - start a bot game
├── api-prefix.ts         - the `/api` prefix, shared with the 404 handler
└── error-handlers/       - the single registered handler, and the not-found handler
```

Request schemas are the zod schemas in `packages/contracts`. There is no local
`schemas/` folder.

## Endpoints

All endpoints are under `/api`.

| Method | Path                              | 2xx              | Other                    |
| ------ | --------------------------------- | ---------------- | ------------------------ |
| GET    | `/health`                         | 200 `{status}`   |                          |
| POST   | `/games`                          | 201 `GameView`   | 502                      |
| POST   | `/bot-games`                      | 201 `GameView`   | 502                      |
| GET    | `/games/:gameId`                  | 200 `GameView`   | 400, 404 (database only) |
| GET    | `/games/:gameId/moves`            | 200 `Move[]`     | 400, 404 (database only) |
| GET    | `/games/:gameId/turn`             | 200 `TurnView`   | 400, 404, 409, 410, 502  |
| POST   | `/games/:gameId/ads/:adId/solve`  | 200 `MoveResult` | 400, 404, 409, 410, 502  |
| POST   | `/games/:gameId/shop/:itemId/buy` | 200 `MoveResult` | 400, 404, 409, 410, 502  |

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

An unknown `/api/*` path answers `404 not_found` as JSON. Any other `GET` that no
route matches is answered with `index.html` when the web app is being served (see
_Serving the web app_).

One file per scope, each exporting a `register[Scope]Routes` function.
`routes/index.ts` registers them under `/api`; `app.ts` adds that to the plugins
and the two handlers and does nothing else.

Routes are **thin**: extract from the request, call a mediator (or a manager when
there is nothing to compose), bind the response. No game logic, no direct
repository or adapter access.

## Validation

Every route declares a schema. Invalid input is rejected at the boundary before
any outbound call is made — this is the brief's "input validation" requirement
and it is not optional.

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
| Fastify 4xx           | `4xx` | Malformed JSON, wrong content type    |
| `UpstreamUnavailable` | `502` | Mugloar unreachable after retries     |
| _(unmapped)_          | `500` | Logged; the message is never sent     |

**Game over is not in this table.** The adapter returns `410` as a terminal
`{ status: 'game_over' }` result and never throws it, so it never reaches the
error handler. A route that receives that result calls `replyGameOver`, which
sends `410 { error: { code: 'game_over', message: 'Game over' } }`.

Every one of these has a designed treatment in the UI. Game over is a screen,
not a toast; an expired ad refreshes the board and says why.

Response bodies share one envelope so the client has a single error path.

## Calling upstream

Routes never call `dragonsofmugloar.com`. Only `mugloar-api-adapter` does, and it
owns:

- timeouts and a bounded retry with backoff on 5xx and network failure
- **never retrying `solve` or `buy`** — they are not idempotent
- tolerating **HTML bodies** on non-2xx responses
- translating `410` into the `GameOver` domain state instead of throwing
- the shared process-wide outbound throttle

See [`architecture.md`](architecture.md) for the verified upstream contract.

## Serving the web app

When `WEB_DIST_DIR` is set, `plugins/web-app.ts` registers `@fastify/static` for
the built React app, and `notFoundHandler` answers any unmatched non-`/api` `GET`
with `index.html` so client-side routes survive a reload. A request for a missing
asset therefore gets `200 text/html`, not a 404 (a known limit). `/api/*` misses
keep the JSON envelope. `WEB_DIST_DIR` is unset in development, where Vite serves
the app and proxies `/api`. `compose.yaml` sets it for the `app` service.

## No streaming

There is no SSE or WebSocket. `/watch` polls `GET /games/:gameId` (and `/moves`
when the move log is open) once a second while the game is `active`. A bot game's
progress is just rows in the database, so a viewer can come and go, reload, or
open the same game twice without touching the run. See
[`frontend.md`](frontend.md) for the polling rule.
