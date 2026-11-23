# Routes

## Organisation

```
routes/
├── index.ts              - registration, called from app.ts
├── schemas/              - request/response schemas, one file per scope
├── game-routes.ts        - start, state, solve, shop, buy
├── bot-routes.ts         - start a bot run, SSE stream
├── stats-routes.ts       - calibration and history reads
├── health-routes.ts      - liveness/readiness
└── error-handlers/       - the single registered handler
```

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
| `GameOver`            | `410` | Terminal, expected. Not a failure.    |
| `GameNotFound`        | `404` |                                       |
| `AdExpired`           | `409` | Board is stale; client should refetch |
| `InsufficientGold`    | `409` |                                       |
| `ValidationError`     | `400` | From the schema layer                 |
| `UpstreamUnavailable` | `502` | Mugloar unreachable after retries     |
| _(unmapped)_          | `500` | Logged with the request id            |

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
