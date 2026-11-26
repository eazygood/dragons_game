# Dragons of Mugloar

Fullstack solution to the Bigbank test task. A React app lets you play
[Dragons of Mugloar](https://dragonsofmugloar.com) with a decision engine's
advice beside every ad, and the same engine can play a whole game on its own.
One Fastify API owns the only client to the game server; the browser never talks
to it directly.

## Run it

```bash
docker compose up --build
```

Open <http://localhost:3000>. The API is on the same port, under `/api`.

- Needs Docker with Compose v2 and internet access (the app plays on the live
  game server). On macOS with Colima, run `colima start` first.
- The first build takes about a minute. Migrations run when the app starts;
  data lives in the `mysql-data` volume (`docker compose down -v` wipes it).
- Port taken? `APP_PORT=3001 MYSQL_PORT=3307 docker compose up --build`.
- Behind a registry mirror or proxy? `NPM_REGISTRY=<url> docker compose up --build`
  (see [Troubleshooting](#troubleshooting)).

## What you can do

1. **Play with advice.** Press _New game_. Every ad shows the engine's verdict,
   win chance and expected value, a banner says what it would do next (solve an
   ad or buy an item), and you click _Solve_ or buy from the shop. Score, gold,
   lives, dragon level and turn stay in the status bar.
2. **Watch the bot.** Press _Let the bot play_. You land on `/watch/<gameId>`,
   which polls the game once a second and ends on "Reached 1000 ✓" with the final
   score, or "Finished at N" below it. A
   game usually takes a minute or two. Tick _Show moves_ for the move log, with
   the engine's reason for each move. In the 2026-11-23 acceptance benchmark most
   bot games ended `abandoned`, not `game_over`: once every ad left is
   `Impossible`, the engine stops with lives to spare. The page treats both
   endings as finished.
3. **Poke the API** with curl or Postman. Examples [below](#error-handling-and-validation).

## How it plays

The decision engine is a pure function: no I/O, no clock, no randomness.

```ts
decide({ state, board, shop, calibration, config }) → Decision   // solve | buy | stop
```

The bot executes the `Decision`; the UI renders it as advice. It is the same
function, so the advisor and the bot cannot disagree, and the strategy is
testable without a network or a database. Each `Decision` carries structured
reasoning (estimated probability, expected value, the rule that fired), which is
what the advice banner and the move log show.

- **Hard filter.** `Impossible` ads (0 of 16 won) and ads that have already
  expired are dropped.
- **Calibration.** The win chance of each ad is a success rate shrunk toward a
  per-label prior, measured over the attempts stored in MySQL and keyed on
  probability label, dragon-level bucket and reward band. The reward band
  matters: `Sure thing` under 100 gold won 47 of 47, at 160 and above 1 of 45.
  The advice reads the counts fresh on every `/turn`. The bot reads them when it
  starts, folds in each of its own solves as it goes, and re-reads them every 10
  turns to pick up evidence from games running beside it, so a game's own
  failures count from the next turn without a query per turn.
- **Expected value.** `p · reward − (1 − p) · lifeCost`, with a lost life priced
  as a healing potion plus the turn it burns.
- **Survival first.** Lives are the binding constraint, so the engine buys a
  healing potion whenever lives are at or below 3 and gold allows.

All thresholds live in one typed `StrategyConfig`.

**Reliability** with `pnpm bench`: 20 cold runs of the calibrated strategy
against the live game. _Cold_ means calibration reads only that benchmark's own
games: the first game starts from the priors alone, which is what a first-time
reviewer with an empty database gets, and the 20 games share evidence as they
go. The same tuned `StrategyConfig`, measured five times:

| Date       | Pass rate at ≥ 1000 | Score min · median · max | Mean turns |
| ---------- | ------------------- | ------------------------ | ---------- |
| 2026-11-23 | **100% (20 of 20)** | 1566 · 2687 · 3576       | 101.2      |
| 2026-11-24 | **95% (19 of 20)**  | 955 · 2723.5 · 3993      | 107.6      |
| 2026-11-25 | **100% (20 of 20)** | 1794 · 2503.5 · 3361     | 108.5      |
| 2026-11-25 | **95% (19 of 20)**  | 41 · 2611 · 3739         | 103.2      |
| 2026-11-25 | **95% (19 of 20)**  | 938 · 2782.5 · 3678      | 107.1      |

97 of 100 games reached 1000, and no benchmark lost more than one. Five
measurements, not a guarantee. The tuning history and the threshold sweep are in
[`phase-1-benchmark.md`](docs/agent_docs/findings/phase-1-benchmark.md).

## Architecture

```
Browser (React 19, TanStack Router + Query) ──/api──► Fastify

  Routes         HTTP in, HTTP out; no logic
    ▼
  Mediators      compose a response from managers
    ▼                                          cli/ (pnpm bot, pnpm bench)
  Managers  ◄──────────────────────────────────┘
                 game rules, transactions, the bot loop ──► Decision engine (pure)
    ▼
  Repositories   one entity each, one file per data source
    ▼
  Adapters       MySQL (knex) · dragonsofmugloar.com (fetch, throttled)
```

Dependencies move downward only; the `no-restricted-imports` rules in
`eslint.boundaries.mjs` make `pnpm lint` fail on a shortcut. The CLIs call
managers directly, because the bot loop is a manager and a mediator would only
pass it through; `StrategyConfig` reaches them as a re-export from
`bot-manager`, so `cli/` never imports `engine/`. Everything goes through
Fastify so the retry, decode and `410` logic is written once, and the advisor
can learn from the history of every game.

One bot turn, as `playTurn` in `managers/bot-manager.ts` plays it:

```mermaid
sequenceDiagram
    participant Bot as bot-manager
    participant Game as game-manager
    participant Cal as calibration-manager
    participant Engine as decide (pure)
    participant Up as dragonsofmugloar.com
    participant DB as MySQL

    Bot->>Game: findAds
    Game->>Up: GET /messages (reads retry)
    Up-->>Game: ads, decoded, unpriceable ones dropped
    opt every 10th turn
        Bot->>Cal: loadCalibration
        Cal->>DB: GROUP BY over ad_attempts
    end
    Bot->>Engine: decide(state, board, shop, calibration, config)
    Engine-->>Bot: Decision: solve, buy or stop
    alt stop
        Bot->>Bot: end the run abandoned
    else solve or buy
        Bot->>Game: executeDecision
        Game->>Up: POST solve or buy (never retried)
        Up-->>Game: outcome, or 410 game over
        Game->>DB: one transaction: run state and the attempt or purchase row
        Bot->>Cal: learnFromAttempt, if the row was saved
    end
```

A turn that fails because the upstream is down or the ad is gone is logged and
the loop plays on; the third failure in a row ends the run `abandoned`.

```
apps/api/            Fastify API: plugins, routes, mediators, managers, repositories,
                     adapters, engine, cli/ (bot, bench), migrations, tests
apps/web/            React app: api/ (query + mutation functions), features/, routes/,
                     Vitest tests, Playwright specs
packages/contracts/  zod schemas the API and the web exchange: responses, errors, ids
docs/agent_docs/     the detail: architecture, database, routes, frontend, testing
```

## State management

There are four kinds of state, each in one place. **Server state** (the game,
the advised board, the shop, the move log) lives in the TanStack Query cache.
**The game id** lives in the URL (`/play/$gameId`, `/watch/$gameId`), so a
reload or a shared link resumes the game. **Ephemeral UI** (the resume form's
draft, the _Show moves_ checkbox) is local `useState`. Everything else, such as
whether a buy is affordable or whether a game has reached 1000, is **derived**
during render. There is no Redux or Zustand store, on purpose: no state exists
that the server does not own, and a client store would be a second copy that can
disagree with the first. There are no optimistic updates either: a solve's
outcome is random and only the server knows it, so the screen waits for the
answer. A successful move seeds the cache with the `MoveResult`'s new game
state, so the status bar updates without a refetch, and the game's queries are
invalidated even when the move fails, because a failed move can still burn a
turn. `/watch` polls only while the game is `active`. Query keys, the retry
policy and polling: [`frontend.md`](docs/agent_docs/frontend.md#state-management).

## Error handling and validation

Three boundaries, one set of zod schemas shared by both sides:

1. **User input → client.** UX only: the resume form checks the id shape, start
   buttons lock while a start is in flight.
2. **Client → API.** Every route that takes input declares a Fastify schema;
   the server never trusts the client. Ids must match `^[A-Za-z0-9_-]{1,64}$`
   and are rejected before any outbound call.
3. **API → client.** Every response is parsed with its contract schema in the
   query function, before a component sees it.

Errors bubble to one handler and always use one envelope,
`{"error": {"code": "...", "message": "..."}}`. The game server's own errors are
HTML, and game over (`410`) is a domain state, not an exception. Upstream detail
never reaches a client: a `5xx` carries a fixed message, and the cause (status,
the start of the HTML body) goes to the log.

| Status | `code`                 | When                                                                                                    |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| 400    | `invalid_request`      | An id fails the shape check, or a `POST` with a JSON content type has an empty or malformed body        |
| 403    | `invalid_request`      | A browser `POST` from another site (`Sec-Fetch-Site: cross-site`, or an `Origin` naming another host)   |
| 404    | `not_found`            | Unknown game (including one the game server has expired), item not in the shop, or unknown `/api` route |
| 409    | `conflict`             | The ad is no longer on the board, not enough gold, or the game belongs to the bot                       |
| 410    | `game_over`            | A turn, solve or buy on a finished game (the losing solve itself answers 200)                           |
| 413    | `invalid_request`      | A request body over 1 KiB; no route takes a body                                                        |
| 415    | `invalid_request`      | A `POST` with a body that is not JSON (`text/plain` included)                                           |
| 429    | `too_many_requests`    | A rate limit, or a fourth concurrent bot game. Both carry `Retry-After` (30 s for the bot cap)          |
| 500    | `internal`             | Anything unmapped. The message is generic; the detail goes to the log                                   |
| 502    | `upstream_unavailable` | The game server did not answer after retries (reads retry; `solve` and `buy` never do)                  |
| 503    | `service_unavailable`  | `POST /bot-games` while the server is shutting down                                                     |

The cross-site check exists because CORS does not stop a page on another site
from sending a `POST` through a visitor's browser; it only hides the response.
curl and Postman send neither header, so they pass.

Rate limits are per client IP and per route, kept in memory:

| Route                                            | Limit                           |
| ------------------------------------------------ | ------------------------------- |
| `POST /games`, `POST /bot-games`                 | 10 a minute each                |
| `POST .../solve`, `POST .../buy`                 | 120 a minute                    |
| `GET /games/:gameId/turn`                        | 60 a minute (it reads upstream) |
| `GET /games/:gameId`, `GET /games/:gameId/moves` | 300 a minute (the web polls)    |
| `GET /health`                                    | unlimited                       |

At most 3 bot games play at once. Every response carries security headers
(`@fastify/helmet`): a CSP that allows only the app's own origin,
`X-Frame-Options: DENY`, and no HSTS, because the app is served over plain
http. `GET /api/health` is a liveness check: it answers `200 {"status":"ok"}`
while the process runs and never queries MySQL.

```bash
API=http://localhost:3000/api

# Start a game                                                    → 201
GAME=$(curl -s -X POST $API/games | jq -r .state.gameId)

# Game state                                                      → 200
curl -s $API/games/$GAME

# The turn: board with per-ad advice, shop, recommendation        → 200
curl -s $API/games/$GAME/turn

# Solve the recommended ad (a fresh game recommends a solve)      → 200
AD=$(curl -s $API/games/$GAME/turn | jq -r .recommendation.adId)
curl -s -X POST $API/games/$GAME/ads/$AD/solve

# Buy a healing potion                                            → 200 with 50+ gold, else 409
curl -s -X POST $API/games/$GAME/shop/hpot/buy

# Moves made so far, newest first                                 → 200
curl -s $API/games/$GAME/moves

# Start a bot game; it keeps playing after the request returns    → 201
BOT=$(curl -s -X POST $API/bot-games | jq -r .state.gameId)
curl -s $API/games/$BOT/moves        # grows while the bot plays  → 200
curl -s $API/games/$BOT/turn         # not playable by hand       → 409

# Liveness: no MySQL query                                        → 200
curl -s $API/health

# Errors
curl -s $API/games/not%20an%20id     # invalid id                 → 400
curl -s $API/games/doesnotexist      # unknown game               → 404
curl -s -X POST -H 'content-type: text/plain' -d x $API/games  # → 415
```

Add `-i` to see the status line and the headers. A start counts against the
10-a-minute limit, so a burst of the commands above can answer `429`. To reach a `410`, play until the lives run out:
the move that takes the last life answers `200` with `status: game_over`, and the
next turn, solve or buy answers `410`.

In Postman, leave the body type on _none_. A `POST` sent with
`Content-Type: application/json` and an empty body is answered with
`400 invalid_request`, and none of the `POST` routes takes a body.

## Setup for tests and local development

Needs Node 26 (`.nvmrc`) and pnpm 12.4.2 (`npm install --global pnpm@12.4.2`),
then `pnpm install` once.

## Tests

```bash
pnpm test               # unit, contract and component tests; no database or network
docker compose up -d --wait mysql   # once, before the two below
pnpm test:integration   # repositories, migrations, routes; needs MySQL
pnpm db:migrate && pnpm bench   # 20 live games, pass rate against 1000; slow, never part of the suites
pnpm test:e2e           # Playwright: Chromium, Firefox, WebKit, each at 360, 768 and 1280px
pnpm lint && pnpm format:check && pnpm typecheck
```

`--wait` returns once the MySQL healthcheck passes, so the first query does not
race the server's start-up. The integration tests create their own schema in
`dragon_test`; the benchmark writes its games to the `dragon` database, so it
needs the migrations first. The first `pnpm test:e2e` needs the browsers:
`pnpm --filter @dragons-game/web exec playwright install`. E2E intercepts
every `/api` request in the browser, so it needs no API, database or game
server. The web build targets Chrome 111, Firefox 114 and Safari 16.4, the
oldest browsers supported; E2E runs the current engine of each. `pnpm bench --warm` reads all stored history instead of just the run's
own. Test levels, recorded fixtures and the E2E setup:
[`testing.md`](docs/agent_docs/testing.md).

CI (`.github/workflows/ci.yml`) runs lint, format, typecheck and the unit suites,
then the integration tests against a MySQL 8.4 service and the E2E suite, on
every push and pull request to `master`. The benchmark plays the live game, so it
stays manual.

## Local development without Docker for the app

```bash
docker compose up -d --wait mysql   # only the database runs in Docker
pnpm db:migrate
pnpm dev                      # API on :3000, web on :5173 (proxies /api)
pnpm bot                      # optional: one headless game, prints the score
```

Configuration is environment variables with local defaults, validated at start-up
in `apps/api/src/config/index.ts`.

## Known limits

- A bot game is not resumed after a restart. A clean stop (`SIGTERM`, as
  `docker compose down` sends) lets the turn in flight finish and ends the run
  `abandoned`; a crash leaves it `active` forever. So does a failed final
  database write when a bot game ends: it is logged, but nothing retries it.
  Human games resume, because their state is persisted.
- The bot plays on through up to two failed turns in a row (upstream down, or
  the ad gone); the third consecutive failure (`MAX_CONSECUTIVE_FAILED_TURNS`,
  3\) ends the run `abandoned`. A failed solve or buy is never retried.
- The game server forgets a game that sits idle for a while. Our copy still reads
  `active`, so the API answers the next `/turn` with `404`; the play page shows
  "This game has expired on the game server" and offers _Start a new game_.
- A buy that times out but that the upstream did process is lost locally. The
  dragon level is derived from recorded purchases, because `solve` never
  returns it, so that game's level, and the calibration rows keyed on it, stay
  one purchase short.
- Calibration runs a `GROUP BY` over the whole `ad_attempts` history on every
  `/turn` the player loads, and for the bot at the start and every 10 turns. It
  is fast at this size; at scale the counts would need to be cached or
  maintained.
- Late in a game the bot can plateau: with only near-zero ads left it plays the
  safest one, usually fails, buys a potion and tries again, for up to ~30 turns.
  A stop rule would save those turns but cannot raise the pass rate; across 310
  benchmarked games those attempts never decided a 1000. Measured in
  [`phase-1-benchmark.md`](docs/agent_docs/findings/phase-1-benchmark.md) §9.
- Bot games share the single 8 requests per second outbound limit, so the 3
  allowed at once slow each other down.
- **One API process.** The bot-game registry, the rate-limit counters, the
  per-game move lock and the outbound token bucket all live in memory. Two
  replicas would each allow 3 bot games and their own rate limits, could let two
  moves of one game reach the upstream at once, and would double the outbound
  rate. Scaling out needs those moved to a shared store first.
- The compose credentials (`dragon`/`dragon`, the root password) are for local
  use only. Both ports are published on `127.0.0.1`, and the API has no
  authentication, so it is not meant to face a network.
- `eslint-plugin-jsx-a11y` is not installed: it does not support ESLint 10.
  Accessibility rests on the component tests' role queries and manual checks.
- A missing static asset path is answered with the app's `index.html` (SPA
  fallback), not a 404. `/api` paths still get a JSON 404.
- The published Mugloar API docs are wrong in several ways (bare arrays, numeric
  rewards, HTML errors, undocumented `probability` and `encrypted`). The verified
  contract is in [`architecture.md`](docs/agent_docs/architecture.md) §Verified API reference.
- No stats or history pages. The brief asks for play, advice and a reliable bot;
  those are done. Every attempt is stored in `ad_attempts` with the predicted
  chance and the outcome, so a calibration dashboard (predicted against actual
  win rate per probability label) is a query and a page away. It was left out to
  keep the scope on what the brief asks for.

## Troubleshooting

- **`docker build` fails at the corepack or `npm install` step with a
  certificate error**: you are behind a TLS-intercepting proxy, and the image does not trust its
  certificate. Point the build at a registry mirror you can reach with
  `NPM_REGISTRY=<url> docker compose up --build`; the `Dockerfile` passes it to
  npm, pnpm and corepack. Or skip the app image: run only MySQL in Docker and
  the app with the host's `pnpm`, as in
  [Local development](#local-development-without-docker-for-the-app).
- **Containers do not start on macOS.** With Colima, check `colima status` and
  run `colima start`.

## How AI was used

The code was written with an AI coding agent, under rules meant to stop it from
drifting:

- **Rules and ground truth in the repo.** `CLAUDE.md` holds the agent's rules
  (layers, naming, error handling, the upstream's traps) and
  `docs/agent_docs/` the detail. The verified API reference there overrides the
  published docs, which are wrong in several places, so the agent never codes
  against them.
- **Boundaries the linter enforces.** The layer rules are `no-restricted-imports`
  rules in `eslint.boundaries.mjs`, so generated code that skips a layer or
  gives the engine an I/O import fails `pnpm lint` instead of waiting for review.
- **Recorded upstream fixtures.** Contract tests replay real responses from the
  game server (`apps/api/test/fixtures/`), so a guess about its shape fails a
  test instead of a live game.
- **One worktree per task.** Each task ran in its own git worktree under
  `.worktrees/`, so parallel work never shared a checkout.
- **Parallel review agents.** Separate agents, run side by side, reviewed the
  finished work as principal engineers would. Their findings led to rounds of
  fixes in the code today, among them the cross-site guard, rate limits on the
  polled reads, in-memory calibration updates and the expired-game screen.
- **Human decisions.** Strategy and scope were decided by hand: survival first,
  calibration keyed on reward bands, level-ups off after the benchmark, no stats
  pages. Every benchmark figure here was measured, not generated.

_Author's note: to be expanded._

More detail: [`docs/agent_docs/`](docs/agent_docs/README.md).
