# Routes

## Organisation

```
routes/
├── index.ts              - registration under /api, called from app.ts
├── game-routes.ts        - start, state, turn, solve, buy
├── game-over-reply.ts    - the only 410 mapping
├── health-routes.ts      - liveness
├── bot-routes.ts         - (Phase 3) start a bot run, SSE stream
└── error-handlers/       - the single registered handler
```

Request schemas are the zod schemas in `packages/contracts`. There is no local
`schemas/` folder.

## Endpoints

All endpoints are under `/api`.

| Method | Path                              | 2xx              | Other               |
| ------ | --------------------------------- | ---------------- | ------------------- |
| GET    | `/health`                         | 200 `{status}`   |                     |
| POST   | `/games`                          | 201 `GameView`   | 502                 |
| GET    | `/games/:gameId`                  | 200 `GameView`   | 404 (database only) |
| GET    | `/games/:gameId/turn`             | 200 `TurnView`   | 404, 409, 410, 502  |
| POST   | `/games/:gameId/ads/:adId/solve`  | 200 `MoveResult` | 404, 409, 410, 502  |
| POST   | `/games/:gameId/shop/:itemId/buy` | 200 `MoveResult` | 404, 409, 410, 502  |

`GET /games/:gameId` never answers 410: a finished game reports its final state
with `status: 'game_over'`. The client calls it after a 410 to render the end
screen.

One file per scope, each exporting a `register[Scope]Routes` function. `app.ts`
registers them and does nothing else.

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
| `ValidationError`     | `400` | From the schema layer                 |
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

## SSE

`/watch` streams bot decisions. Rules:

- The stream is a **subscriber**, never a driver. Disconnecting a viewer must not
  stop a run.
- Many viewers may attach to one run; fan-out happens in the registry.
- Each event carries the turn's structured `reasoning`, so the UI explains the
  decision rather than just showing the outcome.
- On reconnect the client replays from the persisted decision trail.
- Heartbeat to keep proxies from closing idle streams.
