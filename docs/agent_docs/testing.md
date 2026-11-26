# Testing

## Levels

| Level       | Tool                      | Where                        | Covers                                                                                              |
| ----------- | ------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Contracts   | Vitest                    | `packages/contracts/test/`   | Shared zod schemas, move shapes, probability labels                                                 |
| Unit        | Vitest                    | `apps/api/test/unit/`        | Engine (table-driven), the strategy simulator, decoders, EV maths, calibration, adapter, game lock  |
| Contract    | Vitest + recorded replay  | `apps/api/test/contract/`    | Adapter and repositories against **recorded** responses: boards, shop, moves, HTML errors, `410`    |
| Integration | Vitest + a running MySQL  | `apps/api/test/integration/` | Repositories, migrations, manager transactions, routes, bot runs and calibration, shutdown          |
| API         | Vitest + `fastify.inject` | unit and integration         | Routes, schemas, error mapping (`game-routes.test.ts`, `app.test.ts`, `security-hardening.test.ts`) |
| Component   | Vitest + Testing Library  | `apps/web/test/`             | The API client, retry policy, routing, every play and watch state                                   |
| E2E         | Playwright                | `apps/web/e2e/`              | The built web app with `/api` intercepted in the browser                                            |
| Benchmark   | CLI, manual               | `apps/api/src/cli/bench.ts`  | 20 live runs, pass rate against 1000                                                                |

`pnpm test` runs contracts, the api `unit` and `contract` Vitest projects and
web; integration and E2E have their own scripts. Integration needs a MySQL
server to be running already (`docker compose up -d --wait mysql`): it connects
to `TEST_DATABASE_URL`, by default
`mysql://dragon:dragon@127.0.0.1:3306/dragon_test`. A file that needs the schema
(`useMigratedDatabase`) rebuilds it from scratch before its first test and
empties the runs before each one; the files run serially, because they share
the one schema.

The engine being **pure** is what makes the most important tests fast and
deterministic — no network, no database, no clock.

## What to assert

Pin the behaviour the brief cares about, not the implementation. A refactor must
not break a test. If a test knows which function called which, it is testing the
wrong thing.

The engine is the exception worth effort, and it has four regression suites:

- `test/unit/decide-table.test.ts` — five labels from both sides of the minimum
  probability. Every label is measured as a failure in the top calibration
  bucket only, and `Sure thing`, `Gamble` and `Impossible` run both on an
  unmeasured dragon level and in that bucket, so the level decides whether the
  prior or the measurement prices the ad.
- `test/unit/decide-boundaries.test.ts` — the survival floor and the tie-break
  between equally safe ads.
- `test/unit/minimum-probability.test.ts` — an estimate exactly on the minimum
  probability and one step below it, for both the bot's rule and the advisor's
  verdict.
- `test/unit/calibration-edges.test.ts` — evidence on each reward-band and
  level-bucket edge lands in the cell the edge starts, not the one below it.

Another suite tests the strategy as a whole without the network.
`test/support/simulated-world.ts` is a seeded model of the game: boards follow
the recorded label mix, rewards are skewed low as the recorded boards are, and
each label's hidden success rate is the live one, measured from the stored
attempts. That includes where each easy label's reward trap starts (Sure thing
about 110, Piece of cake 120, Walk in the park 145). Those onsets are measured,
not copied from `rewardBandEdges`, so the world reads nothing from
`StrategyConfig`, and the bands are tested as the approximation they are.
The skew is tuned so the baseline passes about as often as it does live: 0.57
in the model against 0.50 over 22 live games.

`test/support/simulate-game.ts` plays that world with the real `decide`, with
calibration folded in through `withAttempt` exactly as the bot does.
`test/unit/simulate-game.test.ts` plays 100 seeds per strategy and asserts:

- the baseline stays below a 0.7 pass rate, so a world edit cannot make every
  comparison easy again;
- `calibrated` scores over twice the baseline, loses lives at under 0.75 of
  its rate per turn, and passes at least 0.15 more often, even cold;
- starting warm (30 earlier games' evidence) beats starting cold on score,
  pass rate and loss rate, and passes at least 0.95;
- warm, the reward bands beat no bands on score and loss rate.

Cold, one game learns alone; live benchmarks sit between cold and warm, since
concurrent games share their evidence. The suite is a regression guard for
engine changes. It guards the ordering of strategies, not the 1000-point
claim; the live benchmark carries that.

Both derive their expectations from `STRATEGY_CONFIG` rather than literals, so a
retune moves the thresholds without rewriting the tests. They, and the web
fixtures, take the shop from `RECORDED_SHOP_ITEMS`, exported by contracts as
`@dragons-game/contracts/test-support` (`packages/contracts/test/support/index.ts`,
which also exports the `turn-view.ts` builders). `RECORDED_SHOP_ITEMS` itself
lives in `recorded-shop-items.ts` and is checked against a recorded `/shop`
response (see below), so the strategy tests run on a shop the upstream really
served.

## Fixtures are recorded, never written by hand

Hand-written fixtures would assert _our reading_ of the upstream API rather than
the API itself — the exact mistake this project exists to avoid, given that the
published docs are wrong in eight separate ways.

`apps/api/test/fixtures/` holds every response of one live game (`xuRILCk8`,
2026-11-23), stored verbatim: both HTML error bodies in full, the `410 Game
Over` transition, a failed purchase, and boards with `encrypted: 1` (base64) and
`encrypted: 2` (ROT13) ads. `test/support/replay-fetch.ts` serves a path's
recordings in the order they were made and throws once they run out.
`test/support/recorded-game.ts` (`startReplay`) points the adapter at a
`replay.invalid` base URL and stubs `fetch` with a fresh replay.

- `test/contract/recorded-boards.test.ts` parses every recorded board through
  `mugloarRepository.findAds` without dropping an ad, decodes every base64
  `adId` into one `SolveParamsSchema` accepts, decodes the ROT13 ads to known
  labels, and reads the final `410` as `game_over`.
- `test/contract/recorded-moves.test.ts` replays the game start, every solve
  (the game-ending one included), the HTML `404` and `400` bodies (the latter as
  `AdExpiredError`) and the failed purchase through the repositories.
- `test/contract/recorded-shop.test.ts` reads a recorded `/shop` response (a bare
  array, from a second game, `ruZ9j1Af`) through
  `mugloarRepository.findShopItems` field for field, and asserts that it equals
  `RECORDED_SHOP_ITEMS`.

The tool that recorded them was deleted once the fixtures existed; the upstream
is a fixed game, so re-recording is not routine. It is in the git history at
commit 47c7ace should the upstream ever change. Never patch a fixture by hand to
make a test pass — re-record instead.

## Stubbing the upstream

- **Above the adapter** (managers, bot, benchmark), spy on the repositories'
  `mugloar` objects. `test/support/scripted-game.ts` (`scriptGame`) installs a
  whole fake game that way, and `vi.restoreAllMocks()` removes it.
- **The adapter itself** is tested over real HTTP against a stub server
  (`test/support/stub-server.ts`; `failTimes` scripts transient failures for the
  retry tests), or by replaying fixtures (`startReplay`).
  `pointAdapterAt({ baseUrl, overrides })` (`test/support/mugloar-api.ts`) calls
  `configureMugloarApi` with the test config aimed at that URL, which also builds
  a fresh throttle.
- `vitest.config.ts` gives every project fast adapter settings (200 ms timeout,
  1000 req/s) and the unreachable base URL `http://127.0.0.1:1`, so a test that
  forgets to stub cannot reach the live API.

## Concurrency and calibration

- `test/unit/game-lock.test.ts` pins `withGameLock`: a second move of the same
  game runs only after the first has finished, a queue keeps arrival order, one
  game never waits for another, and a move that throws rejects only its own
  caller and leaves the game unlocked, with no unhandled rejection.
- `test/integration/bot-calibration-evidence.test.ts` checks that the
  calibration a bot carries in memory equals a fresh read of the table after a
  whole game, and that the periodic re-read picks up evidence another game wrote
  after this one started.
- `test/integration/bot-turn-persistence.test.ts` covers a bot turn whose record
  cannot be written: the bot plays on from the upstream state, the turn rolls
  back as a whole, and the lost attempt stays out of the calibration.

## Stubbing the API in web tests

Web tests never reach Fastify. `apps/web/test/fetch-stub.ts` replaces `fetch`:

- `stubApi(routes)` takes keys of the form `'METHOD /path'`, built from the real
  `gamePaths`, for example `'GET /api/games/g1/turn'`. A request with no key
  rejects, so the test fails loudly instead of hanging. It returns the stub,
  and `callCountOf(key)` counts the requests to one route.
- Responders: `respondOk({ body })`, `respondWith({ status, body })`,
  `respondNever()` for an in-flight move, and `respondInSequence({ responders })`
  for a game that changes between fetches.
- `renderWithQuery(ui)` gives a fresh no-retry query client. `renderInRouter(ui)`
  also mounts a memory router for components that render `<Link>`. Pass
  `{ queryClient: createQueryClient() }` to either one to test the production
  retry and game-over policy.
- `vitest.config.ts` sets `unstubGlobals: true`, so each test starts with the
  real `fetch` again.

## E2E

```bash
pnpm test:e2e                                           # from the repo root
pnpm --filter @dragons-game/web exec playwright install   # once, to fetch the browsers
```

`apps/web/playwright.config.ts` builds the web app and serves the **production
bundle** with `vite preview` on `127.0.0.1:4173`, because the build is what ships.
No API, database or upstream is started. There are nine projects: Chromium,
Firefox and WebKit, each at a phone width (360 × 740), a tablet width
(768 × 1024) and a desktop width (1280 × 800). Firefox's phone project only
narrows the window, because Playwright rejects `isMobile` there.

Every `/api` request is **intercepted in the browser**, so what is tested is the
layout and behaviour of the UI, not game correctness (that is `pnpm bench`).

- `e2e/api-fixtures.ts` builds each response with the contract's own zod schema
  (`GameViewSchema.parse`, `TurnViewSchema.parse`, `MoveListSchema.parse`), so a
  fixture that drifts from the contract fails when the spec loads. `routeApi({
page, routes })` takes keys of the form `'METHOD /path'`, built from the real
  `gamePaths`, and each responder returns the JSON of a `200`.
- `e2e/guarded-test.ts` is the `test` every spec imports. It first installs a
  **deny-all** route on `**/api/**` that aborts and records the request; `routeApi`
  layers on top and falls back to it for anything it does not script. After the
  spec, any recorded request fails the test, so a request nobody scripted cannot
  pass unnoticed.
- `e2e/layout.ts`: `expectNoHorizontalOverflow` runs on every screen a flow
  visits, so a layout that scrolls sideways fails at 360px; `expectContentWithinCard`
  catches content spilling out of a card's padding, which `scrollWidth` hides; and
  `expectSameWidth` keeps the watch screen's panels in one column width.
- `e2e/document-head.ts` (`expectDocumentTitle`) asserts each route's title and
  that the document has exactly one `<title>`.

Three specs:

1. `play.spec.ts` — start a game, see the engine's advice, solve the recommended
   ad, see the score move; and the start panel stays inside its card and the
   viewport.
2. `watch.spec.ts` — press _Let the bot play_, land on `/watch/:gameId` "In
   progress…", let the scripted game become `abandoned` with a score of 1240, see
   "Reached 1000 ✓", tick _Show moves_ and read the move log. The game flips state
   when the spec says so, not after a request count, because the page may refetch
   on focus and consume a scripted step early. A second test presses _Run the bot
   again_ on the finished game and lands on the new game's `/watch` view.
3. `error-states.spec.ts` — the game ends under the player mid-game and the end
   screen shows; a rate-limited move tells the player to wait and keeps the
   board; an idle game the upstream expired says so, offers a new game and no
   retry; and the upstream being down on load offers a retry that recovers.

The component tests under `apps/web/test/` cover the states the E2E does not
(every error treatment, retry policy, the polling rule, request cancellation).

## Benchmark

```bash
pnpm bench          # 20 cold runs — calibration scoped to this benchmark's games
pnpm bench --warm   # same, keeping accumulated history
```

It needs MySQL running and migrated (`pnpm db:migrate`), because every game it
plays is stored like any other. The measured results, and the tuning history
behind `STRATEGY_CONFIG`, are in
[`findings/phase-1-benchmark.md`](findings/phase-1-benchmark.md) (§6 and §8).

The score target, `TARGET_SCORE` (1000), lives in `packages/contracts`
and is shared with the web app's "Reached 1000" line.

Reports the score distribution, pass rate against 1000, and mean turns survived.

**Cold is the headline number**, because an empty store is what a reviewer gets
on their first `docker compose up`. _Cold_ means calibration reads only the
evidence of the current benchmark's own games: the first game starts from the
priors alone, no history is ever deleted, and the concurrent games learn from
each other as they go. The warm figure shows what the learning is worth. The
README quotes the cold number.

**Our acceptance bar: ≥ 95% of cold runs clear 1000** (19 of 20). It is a bar
we chose, not a figure from the brief.

Phase 1 benchmarks `baseline` and `calibrated` over the same run count. If the
simple strategy already clears the bar, that result is published rather than
buried.

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `master`, in
three jobs:

| Job           | Runs                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| `checks`      | `pnpm install --frozen-lockfile`, `lint`, `format:check`, `typecheck`, `test`            |
| `integration` | `pnpm test:integration` against a `mysql:8.4` service container, via `TEST_DATABASE_URL` |
| `e2e`         | `playwright install --with-deps`, then `pnpm test:e2e`; the report is kept on failure    |

The MySQL service creates `dragon_test` and the `dragon` user from its
environment, so CI needs no init script. Node comes from `.nvmrc` and pnpm from
`packageManager`, so CI and a laptop run the same versions.

**Nothing but the benchmark touches the live API**, and a CI job must never run
it. The benchmark is a manual command — it plays hundreds of real games and its
results depend on a remote service, so it can neither be fast nor deterministic.

## Before a change is done

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

`pnpm format` rewrites what `format:check` reports. Run
`pnpm test:integration` too when the change touches the database, and
`pnpm test:e2e` when it touches the web app's behaviour or layout.

Docker runtime is Colima. The integration tests need the MySQL container
running; a connection failure usually means Colima isn't — check `colima status`.
