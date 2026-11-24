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
- Behind a registry mirror or proxy? `NPM_REGISTRY=<url> docker compose up --build`.

## What you can do

1. **Play with advice.** Press _New game_. Every ad shows the engine's verdict,
   win chance and expected value, a banner says what it would do next (solve an
   ad or buy an item), and you click _Solve_ or buy from the shop. Score, gold,
   lives, dragon level and turn stay in the status bar.
2. **Watch the bot.** Press _Let the bot play_. You land on `/watch/<gameId>`,
   which polls once a second and ends on "Reached 1000" with the final score. A
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
  probability label, dragon-level bucket and reward band. The reward band matters: `Sure thing` under 100 gold
  won 47 of 47, at 160 and above 1 of 45. Calibration is reloaded before every
  decision, so a game's own failures count from the next turn.
- **Expected value.** `p · reward − (1 − p) · lifeCost`, with a lost life priced
  as a healing potion plus the turn it burns.
- **Survival first.** Lives are the binding constraint, so the engine buys a
  healing potion whenever lives are at or below 3 and gold allows.

All thresholds live in one typed `StrategyConfig`.

**Reliability, measured 2026-11-24** with `pnpm bench`: 20 cold runs of the
calibrated strategy against the live game (calibration reads only that
benchmark's own games, which is what a first-time reviewer gets).

| Pass rate at ≥ 1000 | Score min · median · max | Mean turns |
| ------------------- | ------------------------ | ---------- |
| **95% (19 of 20)**  | 955 · 2723.5 · 3993      | 107.6      |

One game fell short, at 955. This is one measurement, not a guarantee. The
tuning history and the threshold sweep are in
[`phase-1-benchmark.md`](docs/agent_docs/findings/phase-1-benchmark.md).

## Architecture

```
Browser (React 19, TanStack Router + Query) ──/api──► Fastify

  Routes         HTTP in, HTTP out; no logic
    ▼
  Mediators      compose a response from managers
    ▼
  Managers       game rules, transactions, the bot loop ──► Decision engine (pure)
    ▼
  Repositories   one entity each, one file per data source
    ▼
  Adapters       MySQL (knex) · dragonsofmugloar.com (fetch, throttled)
```

Dependencies move downward only; `eslint.config.mjs` fails the build on a
shortcut. Everything goes through Fastify so the retry, decode and `410` logic is
written once, and the advisor can learn from the history of every game.

```
apps/api/            Fastify API: routes, mediators, managers, repositories, adapters,
                     domain/engine, bot CLIs, migrations, tests
apps/web/            React app: api/ (query + mutation functions), features/, routes/,
                     Vitest tests, Playwright specs
packages/contracts/  zod schemas for every request, response and error, used by both apps
docs/agent_docs/     the detail: architecture, database, routes, frontend, testing
```

## State management

Server state lives in TanStack Query. There is no Redux or Zustand store, on
purpose: everything the screen shows is derived from the server, and a client
store would be a second copy that can disagree with the first. A solve or buy
invalidates the game's queries even when it fails, because a failed move can
still burn a turn; `/watch` polls only while the game is `active`. Query keys,
the retry policy and polling: [`frontend.md`](docs/agent_docs/frontend.md#state-management).

## Error handling and validation

Three boundaries, one set of zod schemas shared by both sides:

1. **User input → client.** UX only: the resume form checks the id shape, start
   buttons lock while a start is in flight.
2. **Client → API.** Every route declares a Fastify schema; the server never
   trusts the client. Ids must match `^[A-Za-z0-9_-]{1,64}$` and are rejected
   before any outbound call.
3. **API → client.** Every response is parsed with its contract schema in the
   query function, before a component sees it.

Errors bubble to one handler and always use one envelope,
`{"error": {"code": "...", "message": "..."}}`. The game server's own errors are
HTML, and game over (`410`) is a domain state, not an exception.

| Status | `code`                 | When                                                                                             |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------ |
| 400    | `invalid_request`      | An id fails the shape check, or a `POST` with a JSON content type has an empty or malformed body |
| 404    | `not_found`            | Unknown game, item not in the shop, or unknown `/api` route                                      |
| 409    | `conflict`             | The ad is no longer on the board, not enough gold, or the game belongs to the bot                |
| 410    | `game_over`            | A turn, solve or buy on a finished game (the losing solve itself answers 200)                    |
| 502    | `upstream_unavailable` | The game server did not answer after retries (reads retry; `solve` and `buy` never do)           |
| 500    | `internal`             | Anything unmapped. The message is generic; the detail goes to the log                            |

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

# Errors
curl -s $API/games/not%20an%20id     # invalid id                 → 400
curl -s $API/games/doesnotexist      # unknown game               → 404
```

Add `-i` to see the status line. To reach a `410`, play until the lives run out:
the move that takes the last life answers `200` with `status: game_over`, and the
next turn, solve or buy answers `410`.

In Postman, leave the body type on _none_. A `POST` sent with
`Content-Type: application/json` and an empty body is answered with
`400 invalid_request`, and none of the `POST` routes takes a body.

## Tests

```bash
pnpm test               # unit, contract and component tests; no database or network
pnpm test:integration   # repositories, migrations, routes; needs MySQL (docker compose up -d mysql)
pnpm test:e2e           # Playwright: Chromium, Firefox, WebKit, each at 360px and 1280px
pnpm bench              # 20 live games, pass rate against 1000; slow, never part of the suites
pnpm lint && pnpm format:check && pnpm typecheck
```

The first `pnpm test:e2e` needs the browsers: `pnpm --filter @bigbank-dragon/web exec playwright install`.
E2E intercepts every `/api` request in the browser, so it needs no API, database
or game server. `pnpm bench --warm` reads all stored history instead of just the
run's own. Test levels, recorded fixtures and the E2E setup:
[`testing.md`](docs/agent_docs/testing.md).

## Local development without Docker for the app

Needs Node 26 (`.nvmrc`) and pnpm 12.4.2 (`npm install --global pnpm@12.4.2`).

```bash
pnpm install
docker compose up -d mysql    # only the database runs in Docker
pnpm db:migrate
pnpm dev                      # API on :3000, web on :5173 (proxies /api)
pnpm bot                      # optional: one headless game, prints the score
```

Configuration is environment variables with local defaults, validated at start-up
in `apps/api/src/config/index.ts`.

## Known limits

- An API restart leaves an in-progress bot game `active` forever; the loop is
  not resumed. Human games resume, because their state is persisted.
- There is no cap on concurrent bot games. Each one shares the single 8 requests
  per second outbound limit, so many at once all slow down.
- `docker compose down` stops a running bot game abruptly, with no clean finish.
- A missing static asset path is answered with the app's `index.html` (SPA
  fallback), not a 404. `/api` paths still get a JSON 404.
- The published Mugloar API docs are wrong in several ways (bare arrays, numeric
  rewards, HTML errors, undocumented `probability` and `encrypted`). The verified
  contract is in [`architecture.md`](docs/agent_docs/architecture.md) §Verified API reference.

More detail: [`docs/agent_docs/`](docs/agent_docs/README.md).
