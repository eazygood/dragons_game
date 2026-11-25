# Architecture

## Overview

One pnpm monorepo, three runtime pieces. Fastify is the **only** thing that talks
to `dragonsofmugloar.com`; the browser never does. In Docker the same Fastify
process also serves the built React app, so the app and `/api` share one origin.

```mermaid
flowchart TB
    subgraph browser["Browser"]
        UI["React 19 + TanStack Router/Query"]
    end

    subgraph api["Fastify API — apps/api"]
        WEB["plugins/web-app.ts — serves the built SPA"]
        R["Routes — HTTP only"]
        CLI["cli/ — pnpm bot, pnpm bench"]
        MED["Mediators — compose responses"]
        MAN["Managers — game rules, transactions, the bot loop"]
        ENG["Decision engine — PURE"]
        REPO["Repositories — one entity each"]
        MYA["mysql-adapter — knex pool, withTransaction"]
        ADP["mugloar-api-adapter — only outbound caller"]
    end

    DB[("MySQL 8")]
    EXT["dragonsofmugloar.com/api/v2"]

    UI -->|"GET /, assets, index.html"| WEB
    UI -->|"REST /api, polled while a bot plays"| R
    R --> MED --> MAN
    CLI --> MAN
    MAN --> ENG
    MAN --> REPO
    REPO --> MYA --> DB
    REPO --> ADP --> EXT
```

`app.ts` and `cli/live-runtime.ts` are the composition roots: each loads the
config, opens the pool and calls `configureMugloarApi` once. Managers'
`withTransaction` edge to `mysql-adapter` is omitted (footnote under _Layers_).

Why everything goes through Fastify: one source of truth for game state; the
decode / retry / `410` logic is written once instead of twice in two languages;
and the advisor can draw on history from every past game, which a browser-only
client could never do.

---

## Layers

```
Routes → Mediators → Managers → Repositories → Adapters
```

Dependencies move **downward only**. Never skip a layer, never call upward.
`eslint.config.mjs` enforces this with `no-restricted-imports` for `cli/`,
`routes/`, `plugins/`, `mediators/`, `managers/`, `repositories/` and `domain/`, so
a shortcut fails `pnpm lint`. No rule is relaxed for the bot: the loop that calls `decide()`
is a manager precisely so that routes and mediators never import the engine.

| Layer            | May call                                 | Must not                                               |
| ---------------- | ---------------------------------------- | ------------------------------------------------------ |
| **Routes**       | Mediators                                | contain business logic; touch repositories or adapters |
| **CLI**          | Managers                                 | touch repositories or adapters ²                       |
| **Mediators**    | Managers                                 | contain game rules; touch repositories or the engine   |
| **Managers**     | Repositories, Engine, other Managers     | be called by anything below them; touch adapters ¹     |
| **Repositories** | one data-source Adapter                  | span entities; call managers or other repositories     |
| **Adapters**     | one external system                      | contain business logic                                 |
| **Engine**       | `@bigbank-dragon/contracts` schemas only | perform I/O of any kind                                |

¹ The one exception is `withTransaction` from `mysql-adapter`: a manager owns
the transaction boundary, so it opens the transaction and hands it to repositories.
² Except `cli/live-runtime.ts`, the CLIs' composition root, which opens the pool
and configures the Mugloar adapter.

`plugins/` is infrastructure wired in `app.ts`: it may use adapters and mediators
(`plugins/bot-games.ts` builds the registry from `bot-mediator`) but never managers,
repositories or the engine.
`cli/` (`bot.ts`, `bench.ts`, `runBot`, the benchmark, its pool and report)
stands at the mediator level and calls `bot-manager` and `game-manager`.

Contract shapes: mediators build `GameView` and `MoveResult`
(`game-mediator/game-view.ts`) and `TurnView` (`game-mediator/find-turn.ts`); `game-manager`'s
`findMoveHistory` builds `Move[]`, which the mediator passes through; the engine
returns `Decision` and `AdvisedAd`. Types that cross layers live in `entities/`
(`OrGameOver`, `TurnResult`, `SolveOutcome`, `BuyOutcome`, `Logger`, `GameRun`);
the row types (`DbTables`) live in `repositories/db-tables.ts`.

### Routes

Thin. Extract from the request, call a mediator, bind the response. No logic.
Errors bubble to the single registered Fastify error handler; routes never
catch. See [`routes.md`](routes.md).

### Mediators

API-facing aggregators. They call multiple managers and shape an API response.
They hold no game rules. One file per use case inside an entity folder, named
for the operation — `game-mediator/start-game.ts`, not one growing file.

### Managers

Own one entity's lifecycle, its rules and its transaction boundary. A manager
may compose every repository its transaction writes: `game-manager/` owns the
game state machine and writes a turn's run update together with its attempt or
purchase row, atomically. It also fronts the reads (`findAds`, `findShopItems`,
`findRun`, `findPlayableRun`, `findMoveHistory`) so that callers never reach a
repository. When the turn's transaction fails after the upstream move happened,
`PersistenceFailedError` carries the `TurnResult`: the bot plays on
(`keepPlayingOnPersistenceFailure`), the player path saves the state alone
(`saveStateOnPersistenceFailure`); see [`database.md`](database.md).
`calibration-manager/` turns stored attempts into a `Calibration`, falling back
to the prior when the read fails. `bot-manager/` owns the bot's play loop
(`playGame`) and `execute-decision.ts`, which turns a `Decision` into a call on
`game-manager`; see _Bot runtime_.

### Repositories

One entity each, with one file per data source:
`<entity>-repository/{db.ts, mugloar.ts}`, exposed as
`gameRunRepository.db.createOne(...)` and `gameRunRepository.mugloar.createOne()`.
Enforce no business rules. On the DB side, `transform` / `reverseTransform`
convert between the row shape (snake_case) and the domain entity (camelCase).
On the mugloar side, the zod schema's `transform` maps the wire shape into an
entity (`SolveOutcome`, `BuyOutcome`), so `shoppingSuccess` and `highScore`
never get past the repository.

"One entity" governs what a repository returns and writes. A read may still
filter by a related table: `findCalibrationCounts` scopes attempts to a
benchmark with a subquery on `game_runs`. That is cheaper than a second
round-trip through `gameRunRepository`, and it writes nothing.

The `mugloar` side owns the endpoints: the path, the wire schema, and decoding
encrypted ads.

| Upstream call                  | Repository                              |
| ------------------------------ | --------------------------------------- |
| `POST /game/start`             | `gameRunRepository.mugloar.createOne`   |
| `GET /{gameId}/messages`       | `adRepository.mugloar.findMany`         |
| `POST /{gameId}/solve/{adId}`  | `adAttemptRepository.mugloar.createOne` |
| `GET /{gameId}/shop`           | `shopItemRepository.mugloar.findMany`   |
| `POST /{gameId}/shop/buy/{id}` | `purchaseRepository.mugloar.createOne`  |

Every repository is a plain object, never a bare module export: ESM namespaces
are frozen, and `vi.spyOn` needs something it can patch.

### Adapters

Wrap exactly one external system. `mugloar-api-adapter` is the only code that
knows the upstream exists and is unreliable. Repositories call its one function,
`mugloarApiAdapter.request({ operation, method, path, schema, badRequestError })`.
GET is retried with exponential backoff on a network failure or `5xx`; POST
never is.

- **Config is injected once.** Each composition root calls
  `configureMugloarApi({ config })` (`adapter-config.ts`), which also builds the
  process-wide token bucket. An adapter that was never configured reads the
  environment once. Tests call it through `pointAdapterAt`.
- **One deadline per attempt.** A single `AbortSignal.timeout` covers both the
  wait for a throttle token and the `fetch`, so a backed-up queue cannot stretch
  a call past `MUGLOAR_TIMEOUT_MS`.
- **Status mapping.** `410` → `{ status: 'game_over' }`; `404` →
  `GameNotFoundError`; `400` → the caller's `badRequestError` (solve passes
  `AdExpiredError`), otherwise `UpstreamUnavailableError`; anything else non-2xx,
  a network failure or a body that fails the wire schema →
  `UpstreamUnavailableError`. The error's `cause` carries the status and the
  first 120 characters of the body for the log, never for the client.
- **Bad ads are dropped, not fatal.** `wire-schemas.ts` drops an ad failing
  `RawAdSchema`; `domain/decode-ad.ts` drops one whose decoded label is unknown.

### Engine

**Pure.** No I/O, no clock, no randomness. Its only import from outside
`domain/` is `@bigbank-dragon/contracts`, for the shared types and constants
(`Ad`, `GameState`, `Decision`, `IMPOSSIBLE_LABEL`); lint forbids `node:*`,
config, entities, adapters, repositories, managers and `cli/`. The engine owns
its input types: `CalibrationCount` is defined in `calibration.ts`, and the
repository maps rows into it. `StrategyConfig` and the per-label
`PROBABILITY_PRIOR` live in `strategy-config.ts`.

---

## Verified API reference

**This section is ground truth and overrides https://dragonsofmugloar.com/doc/.**
Verified against the live API on 2026-11-23.

Base URL: `https://dragonsofmugloar.com/api/v2`. No auth, no API key.

### Endpoints

| Method | Path                               | Returns                                                     |
| ------ | ---------------------------------- | ----------------------------------------------------------- |
| POST   | `/game/start`                      | `{ gameId, lives, gold, level, score, highScore, turn }`    |
| GET    | `/{gameId}/messages`               | **bare array** of ads                                       |
| POST   | `/{gameId}/solve/{adId}`           | `{ success, lives, gold, score, highScore, turn, message }` |
| GET    | `/{gameId}/shop`                   | **bare array** of `{ id, name, cost }`                      |
| POST   | `/{gameId}/shop/buy/{itemId}`      | `{ shoppingSuccess, gold, lives, level, turn }`             |
| POST   | `/{gameId}/investigate/reputation` | `{ people, state, underworld }`                             |

A new game starts at `lives: 3, gold: 0, level: 0, score: 0, turn: 0`.

### Where the published docs lie

| Docs say                                  | Reality                         |
| ----------------------------------------- | ------------------------------- |
| `/messages` returns `{ messages: [...] }` | returns a **bare array**        |
| `/shop` returns `{ items: [...] }`        | returns a **bare array**        |
| `reward` is a String                      | it is a **Number**              |
| `shoppingSuccess` is a String             | it is a **Boolean**             |
| _(not mentioned)_                         | ads carry **`probability`**     |
| _(not mentioned)_                         | ads carry **`encrypted`**       |
| _(not mentioned)_                         | errors are **HTML**, never JSON |
| _(not mentioned)_                         | game over is **HTTP 410**       |

An ad:

```json
{
  "adId": "BR0b2WyN",
  "message": "Help Gisilfrid Jephson to transport a magic wagon to village in Blackcawl",
  "reward": 17,
  "expiresIn": 7,
  "encrypted": null,
  "probability": "Piece of cake"
}
```

### Encryption

`encrypted` is `null`, `1` or `2`, and applies to **`adId`, `message` and
`probability`** — never to `reward` or `expiresIn`.

- `encrypted: 1` → **Base64**. Verified.
- `encrypted: 2` → **ROT13**. Verified 2026-11-23 from recorded live responses: probability
  `Vzcbffvoyr` → `Impossible`. Rare — one board in four recording sessions. That ad
  was `Impossible`, so solving with a decoded ROT13 `adId` is still unobserved.

**The `adId` must be decoded before use in the solve URL.** Verified:

```
adId "cVlmaFlnRnQ=" → "qYfhYgFt"
POST /solve/cVlmaFlnRnQ=  → 400 Bad Request
```

Encrypted ads carry disproportionately large rewards (122 and 193 observed
against a typical 1–64), so skipping them is expensive.

### Probability labels

Eleven observed. `"Impossible"` is undocumented and went 0/16 — it is a hard
filter, never an EV calculation.

Prior ranking, best → worst. **A prior only** — the engine measures rather than
trusts it:

```
Sure thing · Piece of cake · Walk in the park · Quite likely · Hmmm....
Gamble · Risky · Rather detrimental · Playing with fire · Suicide mission
Impossible
```

### Shop

Effects verified by buying each item in a fresh game.

| id                                    | name           | cost | effect        |
| ------------------------------------- | -------------- | ---- | ------------- |
| `hpot`                                | Healing potion | 50   | **+1 life**   |
| `cs` `gas` `wax` `tricks` `wingpot`   | —              | 100  | +1 level      |
| `ch` `rf` `iron` `mtrix` `wingpotmax` | —              | 300  | **+2 levels** |

Items of equal cost are interchangeable. The listing is not guaranteed static —
read `/shop` rather than hard-coding ids; keep this table as the fallback prior.

### Errors and lifecycle

| Situation                    | Response                             |
| ---------------------------- | ------------------------------------ |
| Unknown `gameId`             | `404`, **HTML** body                 |
| Unknown or expired `adId`    | `400`, **HTML** body                 |
| Insufficient gold            | `200` + `{"shoppingSuccess": false}` |
| Unknown item id              | `200` + `{"shoppingSuccess": false}` |
| Any call after lives reach 0 | `410` + `{"status": "Game Over"}`    |

Three consequences that cause real bugs if missed:

1. **A failed purchase still advances the turn**, so it costs `expiresIn` on
   every ad on the board. Never speculatively buy.
2. **`410` is a terminal domain state, not an error.** The adapter translates it;
   it never throws.
3. **Never assume a parseable JSON body on a non-2xx response.** This is the
   most likely source of an unhandled crash.

---

## Decision engine

```ts
// pure — no I/O, no clock, no randomness
decide({ state, board, shop, calibration, config }): Decision
```

`Decision` is a discriminated union — `solve`, `buy`, or `stop` — each carrying
a **structured `reasoning` value, not a string**: the estimated success
probability, the expected value, and which rule fired. The bot logs it; the UI
renders it. That is what makes "watch the bot" explicable instead of a spinner.

### Advisor

`adviseBoard` wraps `decide` for the human player. It returns the same
`Decision` as the recommendation, plus a verdict for every ad on the board:
`recommended`, `viable`, `long_shot` or `unattemptable`. The advisor calls
`decide` rather than re-implementing it, so the bot and the advice cannot
disagree. When the player picks a different ad, `playerChoiceReasoning` records
the engine's estimate for that ad, with rule `player_choice`.

### Calibration

Every attempt is written to `ad_attempts` with its label, dragon level, turn,
reward and outcome. The estimate is a success rate shrunk toward a per-label
prior, keyed on `(label, levelBucket, rewardBand)`:

```
p̂ = (successes + α·prior) / (attempts + α)      α = smoothingAlpha (tuned: 2)
```

With little data the prior dominates; as evidence accumulates, measurement takes
over. Deliberately simple enough to justify on a whiteboard. Level **buckets**,
not raw levels, because raw cells would be too sparse. **Reward bands**
(`rewardBandEdges`) because the label lies on lucrative ads (`Sure thing`: 47/47
under 100 gold, 1/45 at 160+). The repository returns raw rewards and the engine
buckets them, so the edges are tunable without a query change.

Calibration is **reloaded before every decision**, not once per game: a run's own
failures, and those of concurrent benchmark games, count from the next turn.

### Selection

1. **Hard filter** — drop `Impossible`; drop ads that have already expired
   (`expiresIn` of 0 or less).
2. **Estimate** `p̂` from calibration.
3. **Expected value** — `EV = p̂ · reward − (1 − p̂) · lifeCost`, where
   `lifeCost` is a healing potion (50 gold) plus the turn it burns. This converts
   risk into gold so risky-lucrative and safe-cheap ads compare on one axis.
4. **Survival override**: lives, not gold, are the binding constraint. At or
   below `livesFloor` the engine buys `hpot` before anything else. The tuned
   floor equals the starting lives (3), so every lost life is bought back as soon
   as gold allows. Lives can rise above the start (observed up to 12), but the
   engine never buys above the floor.
   Measured: a run surviving ~90 turns scored 6840; one dying at turn 24 scored 467. **Survival is the strategy.**
5. Take the highest EV clearing `minimumProbability`; else the safest
   attemptable ad; else stop. Stopping means the board is exhausted (every ad
   `Impossible` or expired, measured from turn ~95). Nothing for sale revives
   it, so the engine does not spend gold there. With `levelUpEnabled` (off by
   default) the engine also levels up when no ad clears the floor or when gold
   above `levelUpGoldReserve` allows.

All thresholds live in one typed `StrategyConfig`. No magic numbers in the
engine.

**Two strategies** share the signature and differ only in the `Calibration`
passed in: `baseline` uses the priors alone (does the database earn its place?),
`calibrated` uses history. The Phase 1 comparison is recorded below.

---

## Bot runtime

One loop, three callers. `managers/bot-manager/play-game.ts` plays a game from
its start state to the end: load the shop once, then each turn fetch the board,
reload calibration, call `decide`, and execute the `Decision` through
`game-manager`. The loop lives in a manager because it calls the engine, and
`eslint.config.mjs` forbids routes and mediators from importing `domain/`.

| Caller                            | How it uses the loop                                                       |
| --------------------------------- | -------------------------------------------------------------------------- |
| `pnpm bot` (`cli/run-bot.ts`)     | Starts a game, awaits `playGame`, prints the result.                       |
| `pnpm bench` (`cli/benchmark.ts`) | Runs `runBot` through `runBounded` and reports the pass rate against 1000. |
| `POST /api/bot-games`             | `bot-mediator/start-bot-game.ts` starts a game and **detaches** the loop.  |

`runBounded` (`cli/bounded-pool.ts`) settles every run: one that throws counts in
`failedRuns` and the rest carry on. The advisor and the bot share `game-manager`
and `calibration-manager`, so advice and bot moves take one code path.

**Resilience.** A turn failing with `UpstreamUnavailableError` or
`AdExpiredError` is logged at `warn` and the loop plays on: the next turn
re-reads the board and its response re-syncs lives, gold, score and turn. The
failed solve or buy is never retried. On the third consecutive failure
(`MAX_CONSECUTIVE_FAILED_TURNS`), or any other error, `playGame` ends the run
`abandoned` and rethrows. A lost purchase's dragon level is not recoverable.

### Detached bot games

`POST /api/bot-games` answers `201` with the new `GameView` as soon as the
upstream game exists. The mediator first reserves a slot in the bot-game
registry (`bot-mediator/bot-game-registry.ts`, decorated as `app.botGames` by
`plugins/bot-games.ts`); at the cap (`AppLimits.maxBotGames`, 3) it answers
`429`. It then starts `playGame` with the slot's `AbortSignal` and strategy
`calibrated` over **all** history (`calibrationBenchmarkId: null`), holds the
slot until the game settles and attaches a `.catch` that logs at `error`. The
request does not wait. A failed start releases the slot.

- **No unhandled rejection.** `playGame` tries to end the run `abandoned` before
  it rethrows (a failure of that write is logged and leaves it `active`).
- **How a game ends.** Lives reaching zero is `game_over`. The engine returning
  `stop` is `abandoned`, because the upstream game is still alive. The usual
  ending is `abandoned` (the board runs dry from turn ~95) with a score well over
  1000; both are finished.
- **Viewing.** No SSE and no push. The loop writes the same rows a human's moves
  do; `GET /api/games/:gameId` and `/moves` read them from the database and the
  web app polls. Viewers never affect the run. Player routes refuse a bot game
  with `409`.
- **Concurrency.** Bot, benchmark and human moves share one process-wide token
  bucket (`MUGLOAR_RATE_PER_SECOND`, 8), because what is protected is the remote
  host.
- **Shutdown.** `server.ts` calls `app.close()` on `SIGINT`/`SIGTERM`. The
  `bot-games` plugin's `onClose` runs before the pool closes: it refuses new
  slots, aborts every signal and waits. Each game finishes the turn in flight,
  ends its run `abandoned` and returns. `compose.yaml` allows 30s.
- **Restart.** The loop is not resumed. A crash leaves the run `active`, as does
  a failed final `finishRun` write. A human's game resumes from its row.

A separate worker would need a queue, a second deployable and a cross-process
event path to reach a viewer: real cost, no reviewer-visible benefit at this
size. `playGame` takes everything it needs as arguments, so moving it out later is
contained.

---

## Measured findings

Recorded as they are established. A documented negative result is a finding.

| Question                                 | Status  | Result                                                                                                                          |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Does `calibrated` beat `baseline`?       | yes     | 90% vs 55% pass over 20 cold runs each, before any tuning                                                                       |
| Do labels mean the same at every reward? | **no**  | `Sure thing` 47/47 under 100 gold, 1/45 at 160+ — hence reward bands in the calibration key                                     |
| Does levelling up pay?                   | partly  | proactive (20 runs each): off 100% pass / median 2510, on 95% / 3348, one game apart, so **off**. On an exhausted board: **no** |
| Does the board run dry?                  | **yes** | by turn ~95 every ad is `Impossible`, and 8–22 level-ups bought there won nothing more; the game is over in all but name        |
| Can lives exceed the starting 3?         | yes     | observed up to 12 from repeated potions                                                                                         |
| Is `encrypted: 2` ROT13?                 | yes     | captured 2026-11-23; solving needs the decoded id (raw → `400`, decoded → `200`)                                                |
| Do encrypted ads behave differently?     | no      | 0.73 vs 0.72 success; `was_encrypted` column dropped                                                                            |
| Does reputation affect anything?         | skip    | **each call burns a turn**; values move but nothing uses them                                                                   |
| Is there upstream rate limiting?         | no      | no `429` across every benchmark at 8 req/s, 3 concurrent games                                                                  |

Three measurements with `pnpm bench` (20 cold runs, `calibrated` strategy, the same
tuned defaults): **100% (20/20)** on 2026-11-23 (min 1566, median 2687, max 3576,
mean 101.2 turns), **95% (19/20)** on 2026-11-24 (min 955, median 2723.5, max
3993, mean 107.6 turns) and **100% (20/20)** on 2026-11-25 (min 1794, median
2503.5, max 3361, mean 108.5 turns). Three measurements, not a guarantee. Cold means "this
benchmark's own games only", so the 20 games share evidence as they go.

The acceptance run's endings (16 of 20 stopped on an exhausted board), the
reverted exhausted-board level-up rule and the full threshold sweep are in
[`findings/phase-1-benchmark.md`](findings/phase-1-benchmark.md). The tuned
values themselves live in `STRATEGY_CONFIG` (`domain/engine/strategy-config.ts`).
